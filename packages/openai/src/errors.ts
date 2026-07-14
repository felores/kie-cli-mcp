import type { ErrorRequestHandler, Response } from "express";

export interface OpenAiErrorBody {
  error: {
    message: string;
    type: string;
    param: string | null;
    code: string;
  };
}

export class OpenAiHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly param: string | null = null,
    readonly type = "invalid_request_error",
  ) {
    super(message);
    this.name = "OpenAiHttpError";
  }
}

const PARSER_ERROR_BY_TYPE: Record<
  string,
  { status: number; code: string; message: string }
> = {
  "entity.too.large": {
    status: 413,
    code: "request_too_large",
    message: "The request body is too large.",
  },
  "encoding.unsupported": {
    status: 415,
    code: "unsupported_content_encoding",
    message: "The request Content-Encoding is not supported.",
  },
  "charset.unsupported": {
    status: 415,
    code: "unsupported_charset",
    message: "The request character set is not supported.",
  },
  "request.aborted": {
    status: 400,
    code: "request_aborted",
    message: "The request body was not received completely.",
  },
  "request.size.invalid": {
    status: 400,
    code: "invalid_content_length",
    message: "The request Content-Length does not match its body.",
  },
};

function hasErrorShape(
  value: unknown,
): value is { status?: number; type?: string; message?: string } {
  return typeof value === "object" && value !== null;
}

export function normalizeOpenAiError(error: unknown): {
  status: number;
  body: OpenAiErrorBody;
} {
  if (error instanceof OpenAiHttpError) {
    return {
      status: error.status,
      body: {
        error: {
          message: error.message,
          type: error.type,
          param: error.param,
          code: error.code,
        },
      },
    };
  }


  if (hasErrorShape(error) && error.type) {
    const parserError = PARSER_ERROR_BY_TYPE[error.type];
    if (parserError) {
      return {
        status: parserError.status,
        body: {
          error: {
            message: parserError.message,
            type: "invalid_request_error",
            param: null,
            code: parserError.code,
          },
        },
      };
    }
  }

  if (error instanceof SyntaxError) {
    return {
      status: 400,
      body: {
        error: {
          message: "The request body is not valid JSON.",
          type: "invalid_request_error",
          param: null,
          code: "invalid_json",
        },
      },
    };
  }

  if (
    hasErrorShape(error) &&
    typeof error.status === "number" &&
    error.status >= 400 &&
    error.status < 500
  ) {
    return {
      status: error.status,
      body: {
        error: {
          message: "The request body could not be processed.",
          type: "invalid_request_error",
          param: null,
          code: "invalid_request",
        },
      },
    };
  }

  return {
    status: 500,
    body: {
      error: {
        message: "An internal server error occurred.",
        type: "server_error",
        param: null,
        code: "internal_error",
      },
    },
  };
}

export function sendOpenAiError(res: Response, error: unknown): void {
  const normalized = normalizeOpenAiError(error);
  res.status(normalized.status).json(normalized.body);
}

export const openAiErrorHandler: ErrorRequestHandler = (
  error,
  _req,
  res,
  _next,
) => {
  sendOpenAiError(res, error);
};
