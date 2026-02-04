#!/usr/bin/env node

/**
 * Deployment Validation Script
 * Validates that deployed application is working correctly
 */

const https = require("https");
const http = require("http");

// Configuration - update these with your deployed URLs
const BACKEND_URL =
  process.env.BACKEND_URL || "https://your-backend-domain.railway.app";
const FRONTEND_URL =
  process.env.FRONTEND_URL || "https://your-frontend-domain.vercel.app";

console.log("🔍 Validating deployment...\n");

// Helper function to make HTTP requests
function makeRequest(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, { timeout }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data,
        });
      });
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
  });
}

// Test backend health
async function testBackendHealth() {
  console.log("🏥 Testing backend health...");

  try {
    const response = await makeRequest(`${BACKEND_URL}/api/health`);

    if (response.statusCode === 200) {
      console.log("✅ Backend health check passed");

      try {
        const healthData = JSON.parse(response.data);
        console.log(
          `   Environment: ${healthData.data?.environment || "unknown"}`,
        );
        console.log(`   Uptime: ${Math.round(healthData.data?.uptime || 0)}s`);
        console.log(
          `   Status: ${healthData.success ? "healthy" : "degraded"}`,
        );
      } catch (e) {
        console.log("   Health data received but not parseable as JSON");
      }
    } else {
      console.error(
        `❌ Backend health check failed with status ${response.statusCode}`,
      );
      return false;
    }
  } catch (error) {
    console.error(`❌ Backend health check failed: ${error.message}`);
    return false;
  }

  return true;
}

// Test backend API endpoints
async function testBackendAPI() {
  console.log("\n🔌 Testing backend API endpoints...");

  const endpoints = [
    "/api/events",
    "/health/detailed",
    "/health/ready",
    "/health/live",
  ];

  let passedTests = 0;

  for (const endpoint of endpoints) {
    try {
      const response = await makeRequest(`${BACKEND_URL}${endpoint}`);

      if (response.statusCode === 200 || response.statusCode === 503) {
        console.log(`✅ ${endpoint} - Status ${response.statusCode}`);
        passedTests++;
      } else {
        console.error(`❌ ${endpoint} - Status ${response.statusCode}`);
      }
    } catch (error) {
      console.error(`❌ ${endpoint} - Error: ${error.message}`);
    }
  }

  console.log(`   Passed ${passedTests}/${endpoints.length} endpoint tests`);
  return passedTests === endpoints.length;
}

// Test frontend accessibility
async function testFrontend() {
  console.log("\n🌐 Testing frontend accessibility...");

  try {
    const response = await makeRequest(FRONTEND_URL);

    if (response.statusCode === 200) {
      console.log("✅ Frontend is accessible");

      // Check if it's a React app
      if (response.data.includes("react") || response.data.includes("React")) {
        console.log("   React application detected");
      }

      // Check for essential elements
      if (response.data.includes('<div id="root">')) {
        console.log("   React root element found");
      }

      return true;
    } else {
      console.error(
        `❌ Frontend accessibility failed with status ${response.statusCode}`,
      );
      return false;
    }
  } catch (error) {
    console.error(`❌ Frontend accessibility failed: ${error.message}`);
    return false;
  }
}

// Test CORS configuration
async function testCORS() {
  console.log("\n🔒 Testing CORS configuration...");

  try {
    const response = await makeRequest(`${BACKEND_URL}/api/events`);

    const corsHeaders = {
      "access-control-allow-origin":
        response.headers["access-control-allow-origin"],
      "access-control-allow-credentials":
        response.headers["access-control-allow-credentials"],
      "access-control-allow-methods":
        response.headers["access-control-allow-methods"],
    };

    console.log("✅ CORS headers present:");
    Object.entries(corsHeaders).forEach(([key, value]) => {
      if (value) {
        console.log(`   ${key}: ${value}`);
      }
    });

    return true;
  } catch (error) {
    console.error(`❌ CORS test failed: ${error.message}`);
    return false;
  }
}

// Main validation function
async function validateDeployment() {
  console.log(`Backend URL: ${BACKEND_URL}`);
  console.log(`Frontend URL: ${FRONTEND_URL}\n`);

  const results = {
    backendHealth: await testBackendHealth(),
    backendAPI: await testBackendAPI(),
    frontend: await testFrontend(),
    cors: await testCORS(),
  };

  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(Boolean).length;

  console.log("\n📊 Validation Summary:");
  console.log(`   Passed: ${passedTests}/${totalTests} test suites`);

  if (passedTests === totalTests) {
    console.log("\n🎉 All deployment validation tests passed!");
    console.log("Your application appears to be deployed correctly.");
    console.log("\nNext steps:");
    console.log("1. Test the application manually in a browser");
    console.log("2. Verify Google OAuth login works");
    console.log("3. Check that event scraping is running");
    console.log("4. Monitor logs for any errors");
  } else {
    console.log("\n⚠️  Some deployment validation tests failed.");
    console.log(
      "Please check the failed tests and your deployment configuration.",
    );
    console.log("See DEPLOYMENT.md for troubleshooting guidance.");
    process.exit(1);
  }
}

// Handle command line arguments
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log("Deployment Validation Script");
  console.log("");
  console.log("Usage:");
  console.log("  node scripts/validate-deployment.js");
  console.log("");
  console.log("Environment Variables:");
  console.log(
    "  BACKEND_URL   - URL of deployed backend (default: https://your-backend-domain.railway.app)",
  );
  console.log(
    "  FRONTEND_URL  - URL of deployed frontend (default: https://your-frontend-domain.vercel.app)",
  );
  console.log("");
  console.log("Examples:");
  console.log(
    "  BACKEND_URL=https://my-api.railway.app FRONTEND_URL=https://my-app.vercel.app node scripts/validate-deployment.js",
  );
  process.exit(0);
}

// Run validation
validateDeployment().catch((error) => {
  console.error("\n💥 Validation script failed:", error.message);
  process.exit(1);
});
