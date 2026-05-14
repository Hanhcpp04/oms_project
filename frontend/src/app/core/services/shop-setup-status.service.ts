import { Injectable, computed, inject, signal } from '@angular/core';
import { finalize, map } from 'rxjs';
import { HttpService } from '../http/http.service';

export type ShopSetupStepKey =
  | 'BASIC_INFO'
  | 'BUSINESS_TYPE'
  | 'CATEGORY'
  | 'ADDRESS'
  | 'ORDER_CONFIG'
  | 'OPERATION_CONFIG'
  | 'SUPPORT_CONTACT';

export interface ShopSetupStepStatus {
  key: ShopSetupStepKey;
  completed: boolean;
  required: boolean;
}

export interface ShopSetupStatus {
  setupCompleted: boolean;
  progress: number;
  completedCount: number;
  totalSteps: number;
  completedSteps: ShopSetupStepKey[];
  missingSteps: ShopSetupStepKey[];
  steps: ShopSetupStepStatus[];
}

interface ApiEnvelope<T> {
  data?: T;
}

interface BackendShopSetupStatus {
  setupCompleted?: boolean;
  progress?: number;
  completedCount?: number;
  totalSteps?: number;
  completedSteps?: string[];
  missingSteps?: string[];
  steps?: BackendShopSetupStepStatus[];
}

interface BackendShopSetupStepStatus {
  key?: string;
  completed?: boolean;
  required?: boolean;
}

const KNOWN_STEP_KEYS: ShopSetupStepKey[] = [
  'BASIC_INFO',
  'BUSINESS_TYPE',
  'CATEGORY',
  'ADDRESS',
  'ORDER_CONFIG',
  'OPERATION_CONFIG',
  'SUPPORT_CONTACT'
];

@Injectable({ providedIn: 'root' })
export class ShopSetupStatusService {
  private readonly httpService = inject(HttpService);
  private readonly statusState = signal<ShopSetupStatus | null>(null);
  private readonly loadingState = signal(false);

  readonly status = this.statusState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly incomplete = computed(() => {
    const status = this.statusState();
    return Boolean(status && !status.setupCompleted);
  });

  refresh(): void {
    if (this.loadingState()) {
      return;
    }

    this.loadingState.set(true);
    this.httpService
      .get<ApiEnvelope<BackendShopSetupStatus>>('/shops/me/setup-status')
      .pipe(
        map((response) => normalizeSetupStatus(response.data)),
        finalize(() => this.loadingState.set(false))
      )
      .subscribe({
        next: (status) => this.statusState.set(status),
        error: () => this.statusState.set(null)
      });
  }

  clear(): void {
    this.statusState.set(null);
  }
}

function normalizeSetupStatus(payload: BackendShopSetupStatus | undefined): ShopSetupStatus {
  const steps = (payload?.steps ?? [])
    .map(normalizeStep)
    .filter((step): step is ShopSetupStepStatus => step !== null);

  const completedSteps = normalizeStepKeys(payload?.completedSteps);
  const missingSteps = normalizeStepKeys(payload?.missingSteps);
  const totalSteps = payload?.totalSteps ?? steps.length;
  const completedCount = payload?.completedCount ?? completedSteps.length;

  return {
    setupCompleted: Boolean(payload?.setupCompleted ?? (totalSteps > 0 && completedCount === totalSteps)),
    progress: clampProgress(payload?.progress ?? (totalSteps ? Math.round((completedCount * 100) / totalSteps) : 0)),
    completedCount,
    totalSteps,
    completedSteps,
    missingSteps,
    steps
  };
}

function normalizeStep(step: BackendShopSetupStepStatus): ShopSetupStepStatus | null {
  const key = normalizeStepKey(step.key);

  if (!key) {
    return null;
  }

  return {
    key,
    completed: Boolean(step.completed),
    required: step.required !== false
  };
}

function normalizeStepKeys(values: string[] | undefined): ShopSetupStepKey[] {
  return (values ?? [])
    .map(normalizeStepKey)
    .filter((key): key is ShopSetupStepKey => key !== null);
}

function normalizeStepKey(value: string | undefined): ShopSetupStepKey | null {
  const normalized = value?.trim().toUpperCase() as ShopSetupStepKey | undefined;

  return normalized && KNOWN_STEP_KEYS.includes(normalized) ? normalized : null;
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}
