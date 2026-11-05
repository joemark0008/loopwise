# Workforce & Population Health Early Warning — Plan

> Working name: **TBD** (pick before registration).

Bring clinical, workplace, community and environmental signals together to spot emerging population and workforce
health risks early, explain them, and trigger proportionate preventive action, without exposing individuals.

| Item               | Value                                                                              |
| ------------------ | ---------------------------------------------------------------------------------- |
| Competition        | Future Health Digital Innovation Challenge (Hack2skill, Future Health – Abu Dhabi) |
| Focus area         | Population Health                                                                  |
| Challenge          | **Population and Workforce Health Early Warning**                                  |
| Registration close | **10 Nov 2026**                                                                    |
| Prototype due      | **20 Nov 2026** — working prototype, technical docs, assumptions and limitations   |
| Evaluation         | 20–30 Nov 2026; top 3 present at GITEX (7–11 Dec 2026)                             |
| Prizes             | USD 50k / 35k / 20k                                                                |
| Base               | [quarry](https://github.com/joemark0008/quarry) — **used as-is, no code changes**  |

---

## 1. The brief (what we must satisfy)

**Challenge.** How might we combine population, environmental, service and workplace signals to identify emerging
health risks earlier and support timely, targeted preventive action before they become wider health burdens?

**Asks for:** near-real-time monitoring, predictive analytics, automated prevention triggers; explainable,
privacy-preserving warnings that are early enough to change action, specific enough to be useful and calibrated to
avoid alert fatigue. Data completeness (especially geolocation) is a known limitation.

**Desired outcomes**

1. Multi-signal surveillance — at least two materially different signal types.
2. Explainable anomaly detection — show contributing signals, locations, time periods.
3. Actionable decision support — proportionate action, responsible role, evidence and assumptions.
4. Privacy-preserving views — aggregation, small-cell suppression, role-based access, no individual/disciplinary use.
5. Operational validation — back-test; report lead time, sensitivity, PPV, false alarms, data latency, missing inputs.
6. Health and resilience impact — earlier intervention, fewer severe incidents/illnesses, less absence and lost
   workdays, better evidence for policy.

## 2. Requirement traceability

| Brief requirement                       | Feature                                                                | Section |
| --------------------------------------- | ---------------------------------------------------------------------- | ------- |
| Signals spread across datasets          | Ingest API by facility category + environment puller                   | 4, 5    |
| Near-real-time monitoring               | Detectors every 15–60 min on event reports; latency measured           | 7       |
| Predictive analytics                    | 3–5 day risk forecast from weather forecast + learned heat→illness lag | 8       |
| Automated prevention triggers           | Alert notifier → responsible role (email/SMS/webhook) with action      | 9       |
| Multi-signal surveillance               | Fusion score; Warning needs ≥ 2 signal types                           | 7       |
| Explainable anomaly detection           | Explanation JSON on every alert; quarry explains with charts/maps      | 7, 11   |
| Clusters in a workplace or district     | Grouping by site/department/dormitory/district + neighbour comparison  | 7       |
| Geolocation completeness                | Registry site/district codes, not GPS; geolocation completeness metric | 6, 12   |
| Calibrated, avoid alert fatigue         | Min counts, persistence, de-dup, cool-down, levels tuned in back-test  | 7, 12   |
| Proportionate action + responsible role | Required `recommended_action` + `responsible_role` on every alert      | 9, 10   |
| Evidence and assumptions                | `explanation` + `assumptions` on alerts and forecasts                  | 7, 8    |
| Aggregation + small-cell suppression    | De-identify at ingest; analytic views only; counts < 5 suppressed      | 6, 10   |
| Role-based access                       | DB role + view set per role; quarry project per role                   | 10      |
| No individual / disciplinary use        | No view below department of ≥ 5; quarry refusal skill; data-use policy | 10      |
| Back-test metrics                       | Back-test runner → `validation_results`                                | 12      |
| Behaviour with missing inputs           | Completeness tracking; reruns with each signal removed                 | 7, 12   |
| Health and resilience impact            | Impact estimate per event; policy evidence pack story                  | 13      |
| Laboratory patterns                     | Lab positivity report type (dengue, influenza) in prototype            | 5       |

## 3. Architecture

```
 Hospital    Workplace    LGU / RHU / Lab        Weather + air-quality APIs
    │            │              │                         │
    └──── Ingest API (NestJS) ──┘                   Env puller (hourly)
          auth · schema check · de-identify               │
                    │                                     │
 ┌──────────────────▼─────────────────────────────────────▼──────┐
 │ Warehouse (Postgres)                                          │
 │  raw (JSONB, audit) → clean (typed per report) → analytic views│
 │                                     │  (aggregated, suppressed) │
 │  detectors (15–60 min) → alerts + forecasts + validation       │
 └──────────────┬──────────────────────────────┬─────────────────┘
                │                              │
        Alert notifier                 quarry (read-only, unchanged)
   email / SMS / webhook to role      chat, charts, maps, stories
                │                              │
   Site safety officer · Occupational health · LGU / DOH officer
                          │
            Earlier, targeted preventive action
```

Separate apps, connected only through the database:

```
<repo>/
  quarry/      existing, untouched
  ingest/      NestJS: ingest API, env puller, notifier, simulator
  warehouse/   SQL: schema, views, detectors, forecast, back-test, roles
  docs/        PLAN.md, technical docs, validation report
```

Demo: one docker-compose — Postgres (`quarry` + `warehouse` databases), quarry, ingest.

## 4. Ingest API

**Stack:** NestJS + Postgres, Ajv for JSON Schema validation, `@nestjs/swagger` for OpenAPI docs.

**Modules:** `auth`, `facilities`, `report-types`, `submissions`, `deidentify`, `code-lists`, `quality`, `audit`,
`env-puller`, `notifier`.

**Auth.** One API client per facility (API key for prototype; OAuth2 client credentials later). Token/key resolves
`facility_id`, `category`, allowed `site_ids`. Guards enforce: report type allowed for category; sites belong to the
facility. Rate limits per client. Every request audited.

**Endpoints**

| Method | Path                         | Purpose                                        |
| ------ | ---------------------------- | ---------------------------------------------- |
| POST   | `/v1/reports`                | Submit one report (JSON envelope)              |
| POST   | `/v1/reports/bulk`           | CSV / NDJSON upload                            |
| GET    | `/v1/reports/{submissionId}` | Status, counts, record errors                  |
| GET    | `/v1/report-types`           | Allowed report types + schemas for this client |
| GET    | `/v1/code-lists/{name}`      | Syndromes, age bands, sites, districts         |
| GET    | `/v1/health`                 | Liveness                                       |

**Envelope**

```json
{
	"reportType": "workplace.sickness_absence",
	"schemaVersion": 1,
	"idempotencyKey": "acme-siteB-2026-11-03",
	"periodStart": "2026-11-03",
	"periodEnd": "2026-11-03",
	"records": [
		{
			"siteCode": "AUH-SITE-B",
			"department": "outdoor-civil",
			"absentCount": 14,
			"daysLost": 16,
			"reasonCategory": "heat"
		}
	]
}
```

`facility_id` and `category` come from the credential, never the body.

**Pipeline per submission:** authenticate → idempotency check → schema validation → reference checks (codes, sites,
dates) → de-identify → store raw (JSONB) → load clean (typed) → record quality (latency, accepted/rejected) → `202`
with `submissionId` and record-level errors. Partial acceptance allowed.

**Errors:** `401` credentials, `403` type/site not allowed, `409` idempotency conflict, `422` all invalid, `429` rate
limit.

## 5. Report types by facility category

Common code lists across all categories: syndrome groups, ICD-10 → syndrome map, age bands, sex, site codes,
district codes. Shared codes are what let signals line up.

| Category             | Report type                  | Freq.  | Key fields                                                                           | Prototype |
| -------------------- | ---------------------------- | ------ | ------------------------------------------------------------------------------------ | --------- |
| Hospital             | `hospital.syndromic_visit`   | daily  | date, syndrome, ICD-10, age band, sex, district, site (if work-related), disposition | ✅        |
| Hospital             | `hospital.admissions`        | daily  | admissions by syndrome, ICU/bed occupancy                                            | ✅        |
| Workplace            | `workplace.clinic_visit`     | event  | site, department, shift, outdoor/indoor, syndrome, age band                          | ✅        |
| Workplace            | `workplace.sickness_absence` | daily  | site, department, absent count, days lost, reason category                           | ✅        |
| Workplace            | `workplace.incident`         | event  | site, type (heat stress, fall, chemical), severity, time, outdoor/indoor             | ✅        |
| Workplace            | `workplace.roster`           | weekly | headcount by site/department/shift (denominator)                                     | ✅        |
| Workplace            | `workplace.site_environment` | hourly | on-site WBGT / temperature (optional sensor)                                         | optional  |
| LGU                  | `lgu.surveillance_weekly`    | weekly | cases by disease and district                                                        | ✅        |
| LGU                  | `lgu.community_event`        | event  | flood, water interruption, mass gathering — type, district, dates                    | ✅        |
| LGU                  | `lgu.population`             | yearly | population by district, age band, sex (denominator)                                  | ✅        |
| Laboratory           | `lab.test_positivity`        | daily  | test (dengue NS1, influenza), tested, positive, district, age band                   | ✅        |
| Primary care (RHU)   | `rhu.consult_summary`        | weekly | counts by syndrome, age band, sex, district                                          | docs only |
| Environment (pulled) | weather, air quality         | hourly | temperature, humidity, heat index/WBGT, PM2.5, PM10, O3 per district; **forecast**   | ✅        |

Each report type = versioned JSON Schema (`<type>.v<n>.json`). New versions are added, never edited.

## 6. Warehouse

**Layers**

- `raw_submissions` — de-identified envelope as JSONB, append-only (audit, replay).
- `clean_<report_type>` — typed rows per report type.
- Analytic views — daily/hourly counts and rates per place × group, small-cell suppressed. **Only layer quarry and
  role users can read.**

**Core analytic tables/views**

```
signal_daily      (place, group, date, count, denom, rate)
signal_hourly     (place, group, hour, count)            -- event signals, near-real-time
env_daily         (district, date, wbgt_max, heat_index_max, pm25_mean, is_forecast)
completeness_daily(facility, report_type, date, expected, received)
geo_quality_daily (date, pct_valid_site, pct_valid_district)
```

**De-identification:** names/IDs/addresses/phones stripped at ingest; `workerRef` → HMAC pseudonym (salt kept
outside the DB); exact age → age band; location → site/district. Pseudonyms never appear in analytic views.

## 7. Detectors

**Cadence:** event signals (clinic visits, incidents) every 15–60 min; daily signals (absence, lab, LGU) on arrival;
environment hourly. Measured end-to-end latency reported.

**A. Single-signal anomaly**

- EARS C2: today vs mean/SD of t−9…t−3; flag z > 3.
- EWMA for gradual rises.
- Seasonal baseline (same weekday/weeks, prior years) where history exists.
- Rates use roster/population denominators. Minimum count ≥ 3.

**B. Exposure risk** — e.g. WBGT ≥ 32 °C for ≥ 2 days at sites with outdoor shifts (fires before health signals).

**C. Multi-signal fusion**

```
risk_score = w1·z(heat_visits) + w2·z(absence) + w3·z(incidents) + w4·exposure_flag (+ lab/community terms)
```

Warning requires **≥ 2 materially different signal types**. Weights start equal, tuned by back-test.

**D. Clusters** — by site, department, dormitory, district; compare a place with its neighbours on the same day.

**Alert levels**

| Level   | Rule                                                  | Notified                                  |
| ------- | ----------------------------------------------------- | ----------------------------------------- |
| Watch   | 1 signal elevated, or exposure/forecast risk only     | Dashboard only                            |
| Warning | ≥ 2 signal types elevated, or Watch persisting 2 days | Site safety officer + occupational health |
| Alert   | Warning + severe incidents, or rapid rise             | + LGU / DOH officer                       |

**Fatigue controls:** persistence before escalation, one open alert per place × type (updated, not repeated), 3-day
cool-down, weekly cap per site, thresholds tuned to a target false-alarm rate.

**Missing data:** completeness lowers confidence (missing ≠ zero); fusion with missing signals needs a higher
threshold and is labelled "limited data".

**Alert record**

```
alerts(id, place, type, level, status, opened_at, closed_at,
       contributing_signals JSONB,   -- signal, z, share of score, period
       explanation JSONB,            -- baseline vs observed, places, time window
       assumptions JSONB,            -- roster date, missing inputs, completeness
       recommended_action TEXT,      -- required
       responsible_role TEXT,        -- required
       confidence TEXT)
alert_events(alert_id, at, change)   -- opened, escalated, updated, notified, closed
```

## 8. Forecast (predictive analytics) — gap closed

- Input: weather **forecast** (next 3–5 days) per district + site exposure profile (outdoor shifts).
- Model: per-site Poisson regression of heat-illness visits/absence on WBGT with 0–3 day lags (fit on history);
  simple and explainable.
- Output `forecast_risk(place, target_date, predicted_count, baseline, risk_level, drivers JSONB, assumptions JSONB)`.
- High forecast risk opens a **Watch** (or **Warning** with a second signal) before cases rise — source of lead time.
- Phase 2: gradient-boosted models, air-quality forecasts, infectious-disease nowcasting.

## 9. Automated prevention triggers — gap closed

**Alert notifier** (in `ingest/`):

- Watches `alert_events`; on open/escalate sends to the `responsible_role` contacts for that place.
- Channels: email (prototype), webhook (e.g. a site's ops system), SMS (Phase 2 / simulated).
- Message: level, place, what's rising, recommended action, evidence summary, link to quarry ("Ask why").
- Acknowledgement link → `alert_events` (`acknowledged`, `action_taken`) for follow-up and impact tracking.

**Action playbook** (also a quarry skill):

| Alert type                  | Proportionate action                                               | Responsible role                  |
| --------------------------- | ------------------------------------------------------------------ | --------------------------------- |
| Heat risk (forecast/watch)  | Hydration, shade, buddy checks; brief supervisors                  | Site safety officer               |
| Heat illness warning        | Shift outdoor work to cooler hours, mandatory rest cycles          | Site safety officer + occ. health |
| Heat illness alert          | Stop non-essential outdoor work; medical standby; notify regulator | Occ. health + LGU/DOH officer     |
| Respiratory + PM2.5         | Masks, limit outdoor exertion, check ventilation                   | Site safety officer               |
| GI cluster (dormitory/site) | Canteen/water inspection, hygiene measures                         | Occ. health + LGU sanitation      |
| Dengue/flu positivity rise  | Vector control / vaccination drive in district                     | LGU / DOH officer                 |

## 10. Privacy and role-based access — tightened

- **Role views:** separate warehouse DB role + view set per role:
    - Site safety officer → own sites only.
    - Occupational health → all company sites.
    - LGU / DOH officer → district-level, cross-employer, no company-internal detail below site.
- quarry: one project (warehouse connection) per role using its existing project/group access. No code change.
- **Small-cell suppression:** counts < 5 shown as "<5"; no breakdown below department of ≥ 5 workers.
- **No individual or disciplinary use:**
    - No analytic view contains pseudonyms or person-level rows.
    - quarry context rule + skill: refuse questions about individual workers or performance.
    - Written data-use policy in docs and dashboard footer: prevention only; not for hiring, performance or discipline.
- quarry DB user: `SELECT` on analytic views only; no access to raw/clean tables.
- Audit: ingest audit log + notifier log.

## 11. quarry content (no code changes)

- **Context files:** each view/table explained in clinical/occupational terms; privacy rules.
- **Semantic metrics:** heat-illness rate /1,000 workers, absence rate, incident rate, lab positivity, risk score.
- **Skills:** action playbook (§9), how to explain an alert, privacy refusal, how to read validation results.
- **Saved queries:** open alerts by place, alert explanation, forecast next 5 days, site comparison, completeness.
- **Stories:** weekly early-warning report (scheduled), validation report, **policy evidence pack**, impact report.
- **Maps:** sites and districts with alert levels.

Example questions: "Why is Site B on Warning?", "What's the heat risk for the next 3 days?", "Which districts have
rising dengue positivity?", "How reliable are these alerts?"

## 12. Operational validation (back-test)

- History: 1–2 years. **Real historical weather/air quality** (e.g. Open-Meteo) + **synthetic** health/workplace data
  linked to it, with planted events: heatwaves, PM2.5 spikes, GI dormitory cluster, dengue rise.
- Runner replays day by day (or hour by hour) with only data available at that time (respects reporting latency).
- Metrics per event type and overall:
    - **Lead time** (first alert/forecast → event peak)
    - **Sensitivity** (events detected)
    - **PPV** (alerts that were real events)
    - **False alarms** per site per month
    - **Data latency** (event → available)
    - **Missing inputs:** rerun with each signal removed and with reduced completeness; report the change
    - **Geolocation completeness** effect (rerun with % of records missing site/district)
- Threshold tuning: precision/recall per alert level; choose operating point for a target false-alarm rate.
- Results → `validation_results`; presented as a quarry story and in the technical docs.

## 13. Health and resilience impact — gap closed

- **Impact estimate per detected event:** lead time × assumed intervention effectiveness (cited from literature,
  stated as an assumption) → illnesses, high-severity incidents, absence days and lost workdays avoided.
- Compare scenarios: no system vs retrospective review vs this system.
- **Policy evidence pack** (quarry story, PDF): trends by district and sector, heat–illness relationship, alert
  performance, recommended policy/regulatory actions (e.g. midday work restrictions thresholds).
- Track acknowledgements and actions from the notifier for real-world follow-up in a pilot.

## 14. Simulator (demo)

- Node script in `ingest/`, one API key per demo facility.
- Generates baseline daily/event reports + planted events, posts through the Ingest API (not straight to DB).
- Demo mode: "heatwave day 1→5" in accelerated time so the forecast, Warning, notification and quarry explanation
  happen live.

## 15. Demo script (~3–4 min)

1. Map: normal week across sites/districts.
2. Forecast: heatwave coming → Site B forecast **Watch** (lead time).
3. Simulator streams reports: clinic heat visits + absence rise → **Warning** (2 signal types).
4. Notification arrives (email/webhook) to the site safety officer with action + responsible role.
5. In quarry: "Why?" → contributing signals, places, time window, assumptions; "What should we do?" → playbook.
6. Privacy: ask about an individual worker → refused; LGU view shows only district aggregates.
7. Validation story: lead time, sensitivity, PPV, false alarms, latency, missing-input behaviour.
8. Impact + policy evidence pack.

## 16. Timeline (4–20 Nov 2026)

| Dates     | Work                                                                                          |
| --------- | --------------------------------------------------------------------------------------------- |
| 4 Nov     | Finalise plan + name; repo layout; team roles                                                 |
| 5–6 Nov   | Warehouse schema, code lists, report-type JSON Schemas, roles/views skeleton                  |
| 7–8 Nov   | Ingest API: auth, envelope, validation, de-identification, raw→clean, quality tables, Swagger |
| 9 Nov     | Env puller (historical + forecast); **register on Hack2skill (deadline 10 Nov)**              |
| 10–11 Nov | Simulator + synthetic history with planted events; analytic views + suppression               |
| 12–13 Nov | Detectors (EARS C2, EWMA, exposure, fusion, clusters), alert lifecycle, explanation           |
| 14 Nov    | Forecast model + forecast_risk                                                                |
| 15 Nov    | Alert notifier + playbook + acknowledgements                                                  |
| 16 Nov    | Back-test runner + metrics + impact estimate                                                  |
| 17 Nov    | quarry content: context, metrics, skills, saved queries, stories, role projects               |
| 18 Nov    | End-to-end run, deploy (docker-compose / MicroK8s), fix                                       |
| 19 Nov    | Technical docs, assumptions & limitations, validation report, demo video                      |
| 20 Nov    | Buffer, final checks, **submit**                                                              |

## 17. Assumptions and limitations (draft)

- Health and workplace data are synthetic; weather/air quality are real historical data.
- Intervention effectiveness figures used in impact estimates are literature-based assumptions.
- Thresholds and playbook actions need validation by occupational health and public health experts before a pilot.
- Geolocation is at site/district level; finer location is not used.
- Forecasts depend on weather-forecast accuracy.
- Not a diagnostic tool; no individual-level decisions; not for employment or disciplinary use.

## 18. Phase 2

Advanced models (Farrington, scan statistics, ML forecasts), SMS/WhatsApp notifications, HL7/FHIR feeds from
hospitals, wearables/site sensors at scale, Arabic UI/templates, regulator portal, multi-country deployment.

## 19. Open questions

- Product name.
- Team members and roles (occupational/public health advisor?).
- Demo setting: Abu Dhabi worksites, Philippine LGU, or both.
- Weather/air-quality source and coverage for the chosen city.
- LLM provider for the demo (and a sovereign/local option to mention).
