-- MaterialTracking is append-only: no updates or deletes allowed.
CREATE RULE no_update_material_tracking AS ON UPDATE TO "MaterialTracking" DO INSTEAD NOTHING;
CREATE RULE no_delete_material_tracking AS ON DELETE TO "MaterialTracking" DO INSTEAD NOTHING;
