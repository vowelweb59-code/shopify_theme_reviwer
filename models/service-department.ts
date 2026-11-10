import { Schema, model, models, type InferSchemaType } from "mongoose";
import { uuidId } from "./service-shared";

// A department follows a project's manager: a project managed by this department's manager belongs to it; a project with
// no such manager falls into the default department. Hours follow their project, never the person.
const serviceDepartmentSchema = new Schema(
  {
    _id: uuidId,
    name: { type: String, required: true, unique: true, trim: true },
    isDefault: { type: Boolean, default: false },
    managerUserId: { type: String, default: null },
  },
  { timestamps: true, collection: "service_departments" }
);

export type ServiceDepartmentDoc = InferSchemaType<typeof serviceDepartmentSchema>;
export const ServiceDepartment = models.ServiceDepartment ?? model("ServiceDepartment", serviceDepartmentSchema);
