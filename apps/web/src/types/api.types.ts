export interface ApiSuccessEnvelope<T> {
  data: T;
}

export interface ValidationDetail {
  field: string;
  rule: string;
  message: string;
}

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    requestId: string;
    timestamp: string;
    details?: ValidationDetail[];
  };
}

export class ApiError extends Error {
  readonly code: string;
  readonly requestId: string;
  readonly status: number;
  readonly details?: ValidationDetail[];

  constructor(params: {
    code: string;
    message: string;
    requestId: string;
    status: number;
    details?: ValidationDetail[];
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.code = params.code;
    this.requestId = params.requestId;
    this.status = params.status;
    this.details = params.details;
  }
}
