import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

// Initialize AWS services
const dynamodb = new AWS.DynamoDB.DocumentClient();
const cognito = new AWS.CognitoIdentityServiceProvider();

// Get configuration from environment variables
const USER_POOL_ID = process.env.cup_id;
const CLIENT_ID = process.env.cup_client_id;
const TABLES_TABLE = process.env.tables_table;
const RESERVATIONS_TABLE = process.env.reservations_table;

// Main handler function
export const handler = async (event, context) => {
  console.log("Event:", JSON.stringify({
      path: event.path,
      httpMethod: event.httpMethod,
      headers: event.headers?.Authorization,
      body: event.body
  }));
  try {
    const { resource: path, httpMethod } = event;
    const routes = {
      "POST /signup": handleSignup,
      "POST /signin": handleSignin,
      "GET /tables": handleGetTables,
      "POST /tables": handleCreateTable,
      "GET /tables/{tableId}": handleGetTableById,
      "GET /reservations": handleGetReservations,
      "POST /reservations": handleCreateReservation,
    };
    const routeKey = `${httpMethod} ${path}`;
    const response = routes[routeKey]
      ? await routes[routeKey](event)
      : {
          statusCode: 404,
          headers: corsHeaders(),
          body: JSON.stringify({ message: "Not Found" }),
        };
    return response;
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({
        message: "Internal Server Error",
        error: error.message,
      }),
    };
  }
};

// Sign-in Handler with Improved Debugging and Error Handling
async function handleSignin(event) {
  try {
    const { email, password } = JSON.parse(event.body);
    if (!email || !password) {
      return formatResponse(400, { error: "Email and password are required." });
    }

    const params = {
      AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
      UserPoolId: USER_POOL_ID,
      ClientId: CLIENT_ID,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password
      }
    };

    console.log("Attempting Cognito auth with params:", params);
    
    const authResponse = await cognito.adminInitiateAuth(params).promise();
    
    console.log("Cognito authentication success:", authResponse);
    
    return formatResponse(200, {
      accessToken: authResponse.AuthenticationResult?.IdToken,
      refreshToken: authResponse.AuthenticationResult?.RefreshToken,
      expiresIn: authResponse.AuthenticationResult?.ExpiresIn
    });
  } catch (error) {
    console.error("Signin error:", error);

    if (error.code === "NotAuthorizedException") {
      return formatResponse(400, { error: "Invalid email or password." });
    }
    if (error.code === "UserNotFoundException") {
      return formatResponse(400, { error: "User does not exist." });
    }
    return formatResponse(500, { error: "Internal Server Error" });
  }
}

// Helper functions for CORS headers
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
    'Content-Type': 'application/json'
  };
}

// Helper function for formatting responses
function formatResponse(statusCode, body) {
  return {
    statusCode: statusCode,
    headers: corsHeaders(),
    body: JSON.stringify(body)
  };
}
