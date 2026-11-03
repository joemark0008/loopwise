-- DropForeignKey
ALTER TABLE "context_branch_ownership" DROP CONSTRAINT "context_branch_ownership_project_id_project_id_fk";

-- DropForeignKey
ALTER TABLE "context_branch_ownership" DROP CONSTRAINT "context_branch_ownership_user_id_user_id_fk";

-- DropTable
DROP TABLE "context_branch_ownership";
