/* Flashcard decks keyed by module. Leitner-style: each card has {front, back, tags}. */
window.UDE_DECKS = {
  "module-02-snowflake": {
    title: "Snowflake",
    cards: [
      { front: "What separates compute from storage in Snowflake?", back: "Virtual warehouses are the compute layer; storage is a separate, auto-managed columnar layer. You can spin up multiple warehouses of different sizes all reading the same data without contention." },
      { front: "Default Time Travel retention on Standard vs Enterprise?", back: "Standard: 1 day. Enterprise+: up to 90 days (configured per object via DATA_RETENTION_TIME_IN_DAYS)." },
      { front: "What's the difference between Time Travel and Fail-safe?", back: "Time Travel is user-accessible (SELECT ... AT | BEFORE). Fail-safe is a non-user-accessible 7-day recovery window after Time Travel expires — only Snowflake Support can restore. Both cost storage." },
      { front: "What does CLONE actually copy?", back: "Nothing, initially. Zero-copy clones share underlying micro-partitions with the source; new storage is only consumed for rows that change in either the source or the clone after cloning." },
      { front: "What is a micro-partition?", back: "Snowflake's storage unit: 50–500MB of compressed columnar data, immutable. Min/max metadata per column per partition enables automatic pruning." },
      { front: "When should you add a clustering key?", back: "Rarely. Only on tables >~1TB where query predicates don't align with natural insert order AND pruning ratio is poor. Manual CLUSTER BY is usually the wrong first move — check query profile first." },
      { front: "What is the Result Cache?", back: "24-hour account-level cache of query results. Identical queries against unchanged underlying data return instantly with no warehouse compute." },
      { front: "How do you minimize compute cost in dev warehouses?", back: "Set AUTO_SUSPEND=60 (seconds), AUTO_RESUME=TRUE, start with XSMALL. Multi-cluster OFF for dev. Every minute idle is a billable minute." },
      { front: "Syntax to query a table 5 minutes ago?", back: "SELECT * FROM my_table AT(OFFSET => -60*5);  -- or AT(TIMESTAMP => 'YYYY-MM-DD HH:MM:SS'::TIMESTAMP)" },
      { front: "Stored procedure languages in Snowflake?", back: "SQL Scripting, JavaScript, Python, Scala, Java. Python is the newer, Snowpark-based option — preferred for new work unless SQL Scripting suffices." },
      { front: "What's a Snowflake Stream?", back: "A change-data-capture object tracking INSERTs/UPDATEs/DELETEs on a source table. Reading the stream 'advances' it, like a Kafka consumer offset. Commonly chained into a Task for automated CDC." }
    ]
  },
  "module-03-python": {
    title: "Python for DE",
    cards: [
      { front: "ELT vs ETL in one line?", back: "ELT: load raw then transform in-warehouse with SQL. ETL: transform before loading. Cloud warehouses (Snowflake) made ELT dominant." },
      { front: "Preferred library to bulk-load a pandas DataFrame into Snowflake?", back: "snowflake.connector.pandas_tools.write_pandas — chunks the frame, stages via PUT, then COPY INTO. Dramatically faster than row-by-row INSERTs." },
      { front: "boto3 gotcha when listing S3 objects in a large bucket?", back: "list_objects_v2 returns at most 1000 keys; you MUST paginate (get_paginator('list_objects_v2')) or you will silently miss data." },
      { front: "Why use context managers with snowflake-connector?", back: "`with conn.cursor() as cur:` closes the cursor even on exception, releasing the server-side result set and avoiding leaked warehouse resources." },
      { front: "How should secrets be passed to a data pipeline?", back: "Never hard-coded. AWS Secrets Manager or Parameter Store, retrieved at runtime via boto3, with an IAM role scoped to the exact secret ARN. Never env vars committed to a repo." }
    ]
  },
  "module-04-aws": {
    title: "AWS for DE",
    cards: [
      { front: "What does AWS Glue actually do?", back: "Serverless managed Spark for ETL + a Data Catalog (Hive-compatible metastore) + Crawlers. Authors in PySpark or Scala; billed per DPU-hour (1 DPU = 4 vCPU + 16GB)." },
      { front: "Standard vs Express Step Functions?", back: "Standard: up to 1 year, exactly-once, audited, for long pipelines. Express: up to 5 min, at-least-once, cheap, for high-volume event processing." },
      { front: "S3 event notification options into a pipeline?", back: "Direct to SNS, SQS, Lambda, or EventBridge. EventBridge is the modern default (better filtering, multiple targets, retry). Choose SQS when Lambda downstream must handle bursts gracefully." },
      { front: "What is an IAM trust policy?", back: "JSON on a role defining WHO can assume it (e.g., the Glue service, a specific Lambda). Distinct from the permission policy (WHAT the role can do once assumed)." },
      { front: "Lambda time + memory limits?", back: "Max 15 minutes execution; memory 128MB–10GB (CPU scales with memory). For anything longer, use Glue Python Shell, Glue ETL, ECS Task, or Step Functions to chain Lambdas." }
    ]
  },
  "module-05-matillion": {
    title: "Matillion",
    cards: [
      { front: "Orchestration job vs Transformation job?", back: "Orchestration: the outer DAG — connects to sources, stages files, calls other jobs, handles branching and scheduling. Transformation: visual SQL that compiles to a single pushed-down Snowflake statement." },
      { front: "Where does Matillion transformation compute run?", back: "In Snowflake. Matillion compiles the transformation graph into SQL and submits it; the warehouse does the work. Matillion's own VM is orchestration + metadata." },
      { front: "How do you parameterize a Matillion job for dev/test/prod?", back: "Environment variables and Shared Jobs. Define a Matillion environment per Snowflake target; use job variables for anything that differs by environment (table prefixes, schema names)." },
      { front: "How to version-control Matillion jobs?", back: "Matillion supports Git integration natively (Settings → Project → Git). Commit job XML; use branches per feature; merge via standard PR flow." }
    ]
  },
  "module-07-governance": {
    title: "Governance & RBAC",
    cards: [
      { front: "Snowflake's built-in role hierarchy (top → bottom)?", back: "ACCOUNTADMIN → SYSADMIN → (custom roles) → USERADMIN + SECURITYADMIN. ACCOUNTADMIN also inherits SECURITYADMIN. Never grant ACCOUNTADMIN broadly." },
      { front: "Functional vs Access role pattern?", back: "Access roles own privileges on objects (READ_CUSTOMER_PII). Functional roles represent job titles (ANALYST_CUSTOMER) and get access roles granted to them. Users get functional roles only — cleaner audit." },
      { front: "A masking policy is applied how?", back: "ALTER TABLE t MODIFY COLUMN ssn SET MASKING POLICY mask_ssn; The policy is a SQL expression (usually CASE on CURRENT_ROLE) returning either the real value or a masked value." },
      { front: "Row access vs masking policy — when each?", back: "Masking: hide/redact a column's value for some roles. Row access: hide entire rows for some roles/users (tenant isolation, region-based). Both can coexist on the same table." }
    ]
  },
  "module-08-streaming": {
    title: "Streaming",
    cards: [
      { front: "Kafka partition count trade-offs?", back: "More partitions = higher max consumer parallelism + better throughput. But: more memory/file handles on brokers, more work on rebalances, harder to reduce later. Start with a thoughtful number (target throughput / per-partition limit)." },
      { front: "Consumer group membership — what determines it?", back: "group.id config. All consumers with the same group.id form a group; Kafka assigns each partition to exactly one member. Different group.id = independent read position." },
      { front: "Kinesis shard capacity?", back: "1 MB/s or 1000 records/s write, 2 MB/s read per shard. Throughput scaling = shard count. Enhanced Fan-Out gives each consumer its own 2 MB/s." },
      { front: "Kinesis vs Kafka — most important operational difference?", back: "Ops model: Kinesis is fully managed (no brokers, no ZK/KRaft). Kafka gives more control, tooling, ecosystem — and requires operating it (or paying Confluent to)." },
      { front: "Snowpipe vs Snowpipe Streaming?", back: "Snowpipe: file-based, S3 event-triggered ingest, minutes of latency. Snowpipe Streaming: row-set API, seconds of latency, integrates with the Snowflake Kafka Connector." }
    ]
  },
  "module-09-optimization-capstone": {
    title: "Optimization",
    cards: [
      { front: "First place to look at a slow Snowflake query?", back: "Query Profile. Look for: full table scans without pruning, disk spillage ('Bytes spilled to local/remote storage'), skewed joins, exploding join cardinality." },
      { front: "Warehouse bigger vs more multi-cluster?", back: "Bigger (scale up) = faster individual query. Multi-cluster (scale out) = more concurrent queries at the same speed. They solve different problems — don't confuse them." },
      { front: "Cheap query first-aid before tuning?", back: "Check result cache reuse, check warehouse isn't over-provisioned for the workload, make sure auto-suspend is short in dev. Often the fix is 'stop wasting compute' before 'make compute faster.'" },
      { front: "Signal that clustering would help?", back: "SYSTEM$CLUSTERING_INFORMATION shows a high 'average_overlaps' / low 'average_depth' → selective filters scan many partitions → manual clustering key may help. Only on large, queried-by-predicate tables." }
    ]
  },
  "module-01-orientation": {
    title: "DE Orientation",
    cards: [
      { front: "OLTP vs OLAP in one sentence?", back: "OLTP = row-oriented, transactions, small writes (Postgres, MySQL — 'the app DB'). OLAP = columnar, analytics, bulk reads (Snowflake, BigQuery — 'the warehouse')." },
      { front: "Why columnar storage for analytics?", back: "Analytic queries scan few columns across many rows. Columnar layout means you read only the columns you need, compresses well (column values are similar), and enables vectorized execution." },
      { front: "Medallion architecture layers?", back: "Bronze (raw, ingested as-is), Silver (cleaned, conformed, deduped), Gold (business-ready marts). Lets you reprocess without re-fetching and audit transformations." }
    ]
  },
  "module-06-git-jenkins": {
    title: "Git + Jenkins for DE",
    cards: [
      { front: "How is Snowflake schema change typically managed in CI/CD?", back: "schemachange (Flyway-for-Snowflake): versioned .sql files in a repo; a Jenkins job runs schemachange deploy on merge. Idempotent and auditable." },
      { front: "Why is 'branch = environment' the wrong mental model for DE?", back: "A DE warehouse is shared state. Branches should be ephemeral. Use zero-copy clones of prod data per-branch; drop on merge. Environments (dev/qa/prod) are separate Snowflake accounts/databases, not Git branches." }
    ]
  }
};
