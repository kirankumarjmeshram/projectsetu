export const projectStatuses = ["draft"] as const;

export type ProjectStatus = (typeof projectStatuses)[number];

export function isProjectStatus(value: string): value is ProjectStatus {
  return projectStatuses.some((status) => status === value);
}
