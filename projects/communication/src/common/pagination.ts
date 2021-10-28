export interface PaginationResponsePayload {
  total: number;
  count: number;
  pageCount: number;
  page: number;
}

export interface IPaginationResponse<T = any> extends PaginationResponsePayload {
  data: T[];
  requestParams?: any;
  additionalInfo?: any;
}

export interface IPaginationParams {
  skip: number;
  take: number;
  page: number;
}
