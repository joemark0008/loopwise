-- The lab side of orders (DESIGN.md §2 steps 2–4, §5, §9): the order status lifecycle and the outbound HL7 queue.
-- Additive only: a new `rejected` order status, nullable timestamp/reason columns on `clinical_order`, a boolean on
-- `organization` (default false) and a new `hl7_outbox` table. No existing row changes.

ALTER TYPE "order_status" ADD VALUE IF NOT EXISTS 'rejected';

ALTER TABLE "clinical_order"
    ADD COLUMN "accepted_at" TIMESTAMP(6),
    ADD COLUMN "collected_at" TIMESTAMP(6),
    ADD COLUMN "resulted_at" TIMESTAMP(6),
    ADD COLUMN "reviewed_at" TIMESTAMP(6),
    ADD COLUMN "closed_at" TIMESTAMP(6),
    ADD COLUMN "status_reason" TEXT;

-- The order status machine, enforced for every writer (users and system work alike); the API mirrors it in
-- apps/api/src/clinical/orders/order-status.ts. A status change outside these edges is refused.
CREATE FUNCTION "check_order_transition"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
        (OLD.status::text = 'draft' AND NEW.status::text IN ('sent', 'cancelled'))
        OR (OLD.status::text = 'sent' AND NEW.status::text IN ('accepted', 'rejected', 'cancelled', 'resulted'))
        OR (OLD.status::text = 'accepted' AND NEW.status::text IN ('collected', 'cancelled', 'resulted'))
        OR (OLD.status::text = 'collected' AND NEW.status::text = 'resulted')
        OR (OLD.status::text = 'resulted' AND NEW.status::text = 'reviewed')
        -- A result that arrives after review needs review again.
        OR (OLD.status::text = 'reviewed' AND NEW.status::text = 'resulted')
    ) THEN
        RAISE EXCEPTION 'clinical_order % cannot go from % to %', OLD.id, OLD.status, NEW.status
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END
$$;

CREATE TRIGGER "clinical_order_transition"
    BEFORE UPDATE OF "status" ON "clinical_order"
    FOR EACH ROW EXECUTE FUNCTION "check_order_transition"();

-- Facilities whose lab system takes orders over HL7 through the edge connector (apps/connector). The others work
-- from the worklist screen.
ALTER TABLE "organization" ADD COLUMN "uses_hl7_connector" BOOLEAN NOT NULL DEFAULT false;

CREATE TYPE "hl7_outbox_status" AS ENUM ('pending', 'delivered', 'failed');

-- Outbound HL7 v2 messages (ORM^O01) waiting for a facility's edge connector, which pulls them and posts the ACK back.
CREATE TABLE "hl7_outbox" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "message_type" TEXT NOT NULL,
    "control_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "hl7_outbox_status" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "ack_code" TEXT,
    "ack" TEXT,
    "last_fetched_at" TIMESTAMP(6),
    "acked_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "hl7_outbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hl7_outbox_control_id_unique" ON "hl7_outbox"("control_id");
CREATE INDEX "hl7_outbox_orgId_status_createdAt_idx" ON "hl7_outbox"("org_id", "status", "created_at");
CREATE INDEX "hl7_outbox_orderId_idx" ON "hl7_outbox"("order_id");

ALTER TABLE "hl7_outbox" ADD CONSTRAINT "hl7_outbox_org_id_organization_id_fk"
    FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "hl7_outbox" ADD CONSTRAINT "hl7_outbox_order_id_clinical_order_id_fk"
    FOREIGN KEY ("order_id") REFERENCES "clinical_order"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- Users only enqueue (in the transaction that sends or cancels the order, as the ordering facility's staff); reading
-- and acknowledging is system work behind the facility key.
ALTER TABLE "hl7_outbox" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hl7_outbox_enqueue" ON "hl7_outbox" FOR INSERT TO loopwise_app
    WITH CHECK (EXISTS (
        SELECT 1 FROM clinical_order o
        WHERE o.id = order_id AND o.target_org_id = org_id AND o.ordering_org_id = ANY (app_org_ids())
    ));
GRANT INSERT ON "hl7_outbox" TO loopwise_app;
