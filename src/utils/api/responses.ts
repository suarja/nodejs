/**
 * Standardized API response utilities
 */

/**
 * Creates a successful JSON response
 */
export function successResponse(data: any, status = 200): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data,
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Creates an error JSON response
 */
export function errorResponse(
  message: string,
  status = 400,
  details?: any
): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: message,
      details,
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Standard HTTP status codes for different error scenarios
 */
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

// Express.js compatible versions for our Node.js server
export function successResponseExpress(res: any, data: any, status = 200) {
  return res.status(status).json({
    success: true,
    data,
  });
}

export function errorResponseExpress(
  res: any,
  message: string,
  status = 400,
  details?: any
) {
  return res.status(status).json({
    success: false,
    error: message,
    details,
  });
}
