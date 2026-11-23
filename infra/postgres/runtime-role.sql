\set ON_ERROR_STOP on
\set runtime_role datatalk_app
\getenv configured_runtime_role DATATALK_DB_APP
\if :{?configured_runtime_role}
\set runtime_role :configured_runtime_role
\endif
\getenv runtime_password DATATALK_DB_APP_PASSWORD

-- Run in the application database as the role that owns and runs migrations.
-- An existing role retains its credential. Rotate it via psql \password separately.
SELECT format(
    'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT',
    :'runtime_role',
    :'runtime_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'runtime_role')
\gexec

GRANT USAGE ON SCHEMA public TO :"runtime_role";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO :"runtime_role";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO :"runtime_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"runtime_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO :"runtime_role";
