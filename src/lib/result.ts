// API Route용 응답 헬퍼
export type ApiSuccess<T> = { success: true; data: T };
export type ApiFailure = {
  success: false;
  error: { code: string; message: string; details?: unknown };
};
export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export function ok<T>(data: T): Response {
  return Response.json({ success: true, data } satisfies ApiSuccess<T>);
}

export function fail(
  code: string,
  message: string,
  status = 400,
  details?: unknown
): Response {
  return Response.json(
    { success: false, error: { code, message, details } } satisfies ApiFailure,
    { status }
  );
}

// Server Action용 반환 타입
export type ActionSuccess<T> = { success: true; data: T };
export type ActionFailure = {
  success: false;
  error: { code: string; message: string };
};
export type ActionResult<T> = ActionSuccess<T> | ActionFailure;

export function actionOk<T>(data: T): ActionSuccess<T> {
  return { success: true, data };
}

export function actionFail(code: string, message: string): ActionFailure {
  return { success: false, error: { code, message } };
}
