class ApiError extends Error {
  constructor(code, message = "", errors = [], stack = "") {
    super(message);
    this.code = code;
    this.data = null;
    this.success = false;
    this.message = message;
    this.errors = errors;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export { ApiError };
