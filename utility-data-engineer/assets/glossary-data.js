/* Glossary terms — loaded by glossary.html and linkable from any lesson via #term-id.
   Keep terms short and JD-relevant. */
window.UDE_GLOSSARY = [
  // Snowflake
  { id: "virtual-warehouse", term: "Virtual Warehouse", module: "Snowflake", def: "A cluster of compute resources that executes queries. Snowflake separates compute (warehouses) from storage; you can have multiple warehouses of different sizes reading the same data. Billed per-second while running." },
  { id: "time-travel", term: "Time Travel", module: "Snowflake", def: "Snowflake feature letting you query a table AS OF a past timestamp or statement ID. Default retention is 1 day on Standard, up to 90 days on Enterprise. Useful for undoing bad DMLs and debugging pipeline runs." },
  { id: "zero-copy-clone", term: "Zero-Copy Clone", module: "Snowflake", def: "CREATE TABLE / SCHEMA / DATABASE ... CLONE creates a new object that shares underlying storage with the source until one of them changes. Near-instant, no initial storage cost — ideal for creating dev/test environments from prod." },
  { id: "fail-safe", term: "Fail-safe", module: "Snowflake", def: "Non-user-accessible 7-day recovery period after Time Travel expires. Only Snowflake Support can restore from Fail-safe. Costs storage, cannot be disabled on permanent tables." },
  { id: "micro-partition", term: "Micro-partition", module: "Snowflake", def: "Snowflake's storage unit: 50–500MB of compressed, columnar data, immutable. Snowflake tracks min/max metadata per column per partition, enabling automatic pruning at query time." },
  { id: "clustering-key", term: "Clustering Key", module: "Snowflake", def: "A column or expression that Snowflake uses to co-locate related rows into the same micro-partitions, reducing scan cost on large tables. Most tables don't need one; add only if pruning ratio is poor and table > ~1TB." },
  { id: "result-cache", term: "Result Cache", module: "Snowflake", def: "24-hour cache of query results at the account level. Identical queries against unchanged data return instantly without warehouse compute — one of Snowflake's major optimization wins." },
  { id: "warehouse-suspend", term: "Warehouse Auto-suspend", module: "Snowflake", def: "Configurable idle timeout after which Snowflake suspends a warehouse to stop billing. Default 600s. In dev, set to 60s to avoid burning credits during breaks." },
  { id: "stream", term: "Stream (Snowflake)", module: "Snowflake", def: "A change-data-capture object that records INSERTs, UPDATEs, DELETEs on a table. Paired with Tasks it forms the core of Snowflake-native CDC pipelines." },
  { id: "task", term: "Task (Snowflake)", module: "Snowflake", def: "Scheduled SQL or stored-procedure execution inside Snowflake. Tasks can chain (DAG) and can fire only when a Stream has data, making them a cheap alternative to external orchestrators for simple jobs." },
  { id: "snowpipe", term: "Snowpipe", module: "Snowflake", def: "Serverless, near-real-time ingestion service that loads files from cloud storage (S3/GCS/Azure) into a Snowflake table as they arrive. Triggered by event notifications or REST API." },
  { id: "snowpipe-streaming", term: "Snowpipe Streaming", module: "Snowflake", def: "Row-set ingestion API (not file-based) for low-latency streaming into Snowflake tables. Commonly fed from a Kafka Connect connector." },
  { id: "rbac", term: "RBAC (Snowflake)", module: "Governance", def: "Role-Based Access Control. Privileges are granted to roles, roles are granted to users (or other roles). Snowflake enforces a role hierarchy (SYSADMIN → custom roles → USERADMIN → SECURITYADMIN → ACCOUNTADMIN)." },
  { id: "functional-role", term: "Functional Role", module: "Governance", def: "A role that represents a job function (ANALYST_CUSTOMER, ENGINEER_METER) and is granted to users. Paired with 'access roles' that represent object privileges for cleaner RBAC design." },
  { id: "masking-policy", term: "Masking Policy", module: "Governance", def: "Column-level security object: a SQL expression (usually CASE on CURRENT_ROLE) that returns either the real value or a masked value depending on the querying role. Applied via ALTER TABLE ... MODIFY COLUMN ... SET MASKING POLICY." },
  { id: "row-access-policy", term: "Row Access Policy", module: "Governance", def: "Row-level security object: a SQL expression returning boolean, evaluated per row. Used for tenant isolation, region-based filtering, PII scoping." },

  // AWS
  { id: "s3", term: "Amazon S3", module: "AWS", def: "Object storage. In DE it's the de-facto data lake — landing zone for raw data, staging for ingestion into Snowflake. Familiar concept for any senior engineer; the gotchas are lifecycle policies, versioning, and access patterns." },
  { id: "glue-catalog", term: "Glue Data Catalog", module: "AWS", def: "Central metastore of table definitions over S3 (and other stores). Shared by Athena, Glue ETL, EMR, Redshift Spectrum. Hive-metastore-compatible schema." },
  { id: "glue-crawler", term: "Glue Crawler", module: "AWS", def: "Scheduled discovery job that inspects S3 paths and infers schemas, populating Glue Data Catalog tables. Good for auto-schema; can misclassify types — verify before prod." },
  { id: "glue-job", term: "Glue ETL Job", module: "AWS", def: "Serverless Spark (or Python shell) job managed by AWS. Authored in PySpark or Scala; integrates with Catalog. Billed per DPU-hour; watch job bookmarking for incremental loads." },
  { id: "step-functions", term: "Step Functions", module: "AWS", def: "AWS's orchestrator. State machines in Amazon States Language (ASL) coordinating Lambda, Glue, ECS tasks, etc. Standard workflows for long-running DE pipelines; Express for high-volume events." },
  { id: "lambda", term: "AWS Lambda", module: "AWS", def: "Function-as-a-service. In DE: S3-event triggers, Kinesis consumers, lightweight transforms, glue-code between services. 15-minute max, memory 128MB–10GB." },
  { id: "iam-role", term: "IAM Role", module: "AWS", def: "An identity that can be assumed by a service or user to get temporary credentials. For DE pipelines, create a role per function (glue-customer-etl, lambda-meter-ingest) with least-privilege policies." },
  { id: "kinesis-data-stream", term: "Kinesis Data Streams", module: "Streaming", def: "AWS-managed sharded log of records. Records live 24h–365d, consumers track their position. Think Kafka-lite: same concepts (shards ~ partitions), different ops model." },
  { id: "kinesis-firehose", term: "Kinesis Data Firehose", module: "Streaming", def: "Managed delivery to S3 / Redshift / OpenSearch / Snowflake with buffering, compression, optional Lambda transform. Fully managed; you don't manage shards." },

  // Kafka
  { id: "kafka-topic", term: "Kafka Topic", module: "Streaming", def: "Named, partitioned, replicated log. Producers append; consumers read in order within a partition. The fundamental unit of Kafka." },
  { id: "kafka-partition", term: "Kafka Partition", module: "Streaming", def: "Ordered, append-only log inside a topic. Partition count sets max consumer parallelism within a consumer group and is painful to change later — think it through at design time." },
  { id: "consumer-group", term: "Kafka Consumer Group", module: "Streaming", def: "A set of consumers sharing a group.id; Kafka assigns each partition to exactly one member, enabling horizontal scaling. Offsets are committed per group, allowing independent read positions for different apps." },
  { id: "kafka-connect", term: "Kafka Connect", module: "Streaming", def: "Framework for scalable, fault-tolerant connectors into/out of Kafka. Source connectors (e.g., Debezium for CDC) and sink connectors (e.g., Snowflake Kafka Connector) — no bespoke code for common paths." },

  // Python / ELT
  { id: "elt-vs-etl", term: "ELT vs ETL", module: "Python", def: "ETL transforms before loading into the warehouse; ELT loads raw then transforms in-warehouse using SQL. Modern cloud warehouses (Snowflake) made ELT dominant — compute is cheap and elastic, and raw-retained data is auditable." },
  { id: "snowflake-connector", term: "snowflake-connector-python", module: "Python", def: "Official Python driver. Provides DB-API 2.0 cursors, write_pandas for bulk loads, and PUT/GET for stages. Pair with the Python-based Snowpark for dataframe-style in-warehouse transforms." },
  { id: "boto3", term: "boto3", module: "Python", def: "Official AWS SDK for Python. In DE pipelines you'll mostly use s3, glue, stepfunctions, and secretsmanager clients. Watch for pagination on any list_* call." },

  // Matillion
  { id: "matillion", term: "Matillion", module: "Matillion", def: "Cloud-native ELT platform. Push-down SQL generation: Matillion orchestrates but Snowflake does the work. Orchestration jobs (dependencies, branching, scheduling) call Transformation jobs (component graphs that compile to SQL)." },
  { id: "orchestration-job", term: "Orchestration Job (Matillion)", module: "Matillion", def: "The outer DAG of a Matillion workflow: runs stages like 'Create tables if not exists', 'Stage files from S3', 'Run Transformation', 'Notify'. Has variables, iterators, branching." },
  { id: "transformation-job", term: "Transformation Job (Matillion)", module: "Matillion", def: "Visual SQL: nodes for Input tables → joins/filters/calculations → output to a target table. Matillion compiles this to a single Snowflake SQL statement — all compute happens in Snowflake." },

  // Utility domain
  { id: "ami", term: "AMI (Advanced Metering Infrastructure)", module: "Utility", def: "The system of smart meters that send interval reads (15-minute, hourly, daily) over a network back to the utility. Generates the bulk of modern utility DE data volume." },
  { id: "amr", term: "AMR (Automated Meter Reading)", module: "Utility", def: "Predecessor to AMI — one-way read-out of the meter (drive-by, walk-by). Still present at most utilities for some meter fleets. Lower volume, lower granularity." },
  { id: "cis", term: "CIS (Customer Information System)", module: "Utility", def: "The utility's core billing + customer system. Holds accounts, service agreements, billing cycles. DE workflows routinely integrate CIS exports into the warehouse." },
  { id: "gis", term: "GIS (Geographic Information System)", module: "Utility", def: "Spatial system of record for assets: poles, transformers, substations, service points, circuits. DE pipelines join GIS asset IDs with meter reads and outage events." },
  { id: "oms", term: "OMS (Outage Management System)", module: "Utility", def: "System tracking outages: start time, restoration, affected customers, cause. Feeds reliability metrics (SAIDI, SAIFI, CAIDI)." },
  { id: "saidi", term: "SAIDI", module: "Utility", def: "System Average Interruption Duration Index. Total customer-minutes of interruption / total customers. A headline reliability KPI for utilities; regulator-reported." },
  { id: "saifi", term: "SAIFI", module: "Utility", def: "System Average Interruption Frequency Index. Total customer interruptions / total customers. Number of outages an average customer experiences per year." },
  { id: "caidi", term: "CAIDI", module: "Utility", def: "Customer Average Interruption Duration Index. SAIDI / SAIFI = average length of an outage once it happens." },
  { id: "meter-to-cash", term: "Meter-to-Cash", module: "Utility", def: "End-to-end data flow from meter read through VEE (validation, estimation, editing) through billing to payment. The dominant DE pipeline in most utilities." },
  { id: "vee", term: "VEE (Validation, Estimation, Editing)", module: "Utility", def: "Mandatory processing step on raw meter reads before billing: validate reasonableness, estimate gaps (missed reads), flag for analyst editing. Regulated; audit trails required." },
  { id: "der", term: "DER (Distributed Energy Resources)", module: "Utility", def: "Generation or storage on the customer side (rooftop solar, batteries, EVs). Flips historical assumptions — customers can export to grid, meter flows bidirectional." },

  // CI/CD
  { id: "jenkins", term: "Jenkins", module: "Git/Jenkins", def: "Automation server for building, testing, deploying. In DE: commonly runs dbt tests, Matillion deploys via API, Snowflake DDL migrations. Older but still dominant in regulated/utility shops." },
  { id: "schemachange", term: "schemachange", module: "Git/Jenkins", def: "Open-source database-change tool for Snowflake (Flyway-style). Versioned SQL files executed in order; tracks applied state. Runs cleanly from Jenkins." }
];
