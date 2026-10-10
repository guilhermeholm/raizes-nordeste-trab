export interface ErrorDetail {
  field: string;
  issue: string;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly details: ErrorDetail[];

  constructor(message: string, statusCode = 400, errorCode = 'BAD_REQUEST', details: ErrorDetail[] = []) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
