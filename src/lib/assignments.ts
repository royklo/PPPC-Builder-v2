export type AssignmentMode = 'none' | 'allUsers' | 'allDevices' | 'groups';

export interface AssignmentFilterRef {
  id: string;
  displayName: string;
  type: 'include' | 'exclude';
}

export interface GroupTarget {
  id: string;
  displayName: string;
  intent: 'include' | 'exclude';
  /** Per-group filter (only honored when intent === 'include'). */
  filter: AssignmentFilterRef | null;
}

export interface AssignmentConfig {
  mode: AssignmentMode;
  groups: GroupTarget[];
  /** Filter applied to All Users / All Devices. Ignored when mode === 'groups'
   *  — per-group filters live on each GroupTarget. */
  filter: AssignmentFilterRef | null;
}

export const EMPTY_ASSIGNMENT: AssignmentConfig = {
  mode: 'none',
  groups: [],
  filter: null,
};

/** Build the Graph /assign request body for a deviceConfiguration. */
export function buildAssignmentBody(cfg: AssignmentConfig): {
  assignments: Array<Record<string, unknown>>;
} {
  if (cfg.mode === 'none') return { assignments: [] };

  const assignments: Array<Record<string, unknown>> = [];

  const filterTarget = cfg.filter
    ? {
        deviceAndAppManagementAssignmentFilterId: cfg.filter.id,
        deviceAndAppManagementAssignmentFilterType: cfg.filter.type,
      }
    : {};

  if (cfg.mode === 'allUsers') {
    assignments.push({
      '@odata.type': '#microsoft.graph.deviceConfigurationAssignment',
      target: {
        '@odata.type': '#microsoft.graph.allLicensedUsersAssignmentTarget',
        ...filterTarget,
      },
    });
  } else if (cfg.mode === 'allDevices') {
    assignments.push({
      '@odata.type': '#microsoft.graph.deviceConfigurationAssignment',
      target: {
        '@odata.type': '#microsoft.graph.allDevicesAssignmentTarget',
        ...filterTarget,
      },
    });
  } else if (cfg.mode === 'groups') {
    for (const g of cfg.groups) {
      // Per-group filter (only valid for include intent)
      const perGroupFilter =
        g.intent === 'include' && g.filter
          ? {
              deviceAndAppManagementAssignmentFilterId: g.filter.id,
              deviceAndAppManagementAssignmentFilterType: g.filter.type,
            }
          : {};
      assignments.push({
        '@odata.type': '#microsoft.graph.deviceConfigurationAssignment',
        target: {
          '@odata.type':
            g.intent === 'include'
              ? '#microsoft.graph.groupAssignmentTarget'
              : '#microsoft.graph.exclusionGroupAssignmentTarget',
          groupId: g.id,
          ...perGroupFilter,
        },
      });
    }
  }

  return { assignments };
}
