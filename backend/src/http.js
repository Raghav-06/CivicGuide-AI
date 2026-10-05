/** Error carrying an HTTP status; rendered as {"detail": "...", "code"?: "..."}. */
export class HttpError extends Error {
  constructor(status, detail, code) {
    super(detail);
    this.status = status;
    this.code = code;
  }
}

/** Wrap async handlers so rejections reach the error middleware. */
export const route = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
