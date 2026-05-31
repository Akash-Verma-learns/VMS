-- Run this once after prisma db push to make ApprovalAudit append-only.
-- Connect: psql postgresql://vms_user:vms_local_dev@localhost:5432/upsc_vms_dev
-- Then paste these two statements.

CREATE RULE no_update_approval_audit AS ON UPDATE TO "ApprovalAudit" DO INSTEAD NOTHING;
CREATE RULE no_delete_approval_audit AS ON DELETE TO "ApprovalAudit" DO INSTEAD NOTHING;
