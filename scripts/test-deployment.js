#!/usr/bin/env node

/**
 * Deployment Test Script
 * Tests build processes and deployment compatibility
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("🚀 Testing deployment compatibility...\n");

// Test backend build
console.log("📦 Testing backend build...");
try {
  execSync("npm run build:clean", { stdio: "inherit" });

  // Check if dist directory exists and contains files
  const distPath = path.join(__dirname, "..", "dist");
  if (!fs.existsSync(distPath)) {
    throw new Error("dist directory not created");
  }

  const distFiles = fs.readdirSync(distPath);
  if (distFiles.length === 0) {
    throw new Error("dist directory is empty");
  }

  console.log("✅ Backend build successful");
  console.log(`   Generated ${distFiles.length} files in dist/`);
} catch (error) {
  console.error("❌ Backend build failed:", error.message);
  process.exit(1);
}

// Test frontend build
console.log("\n📦 Testing frontend build...");
try {
  process.chdir(path.join(__dirname, "..", "frontend"));
  execSync("npm run build", { stdio: "inherit" });

  // Check if build directory exists and contains files
  const buildPath = path.join(process.cwd(), "build");
  if (!fs.existsSync(buildPath)) {
    throw new Error("build directory not created");
  }

  const buildFiles = fs.readdirSync(buildPath);
  if (buildFiles.length === 0) {
    throw new Error("build directory is empty");
  }

  // Check for essential files
  const indexHtml = path.join(buildPath, "index.html");
  if (!fs.existsSync(indexHtml)) {
    throw new Error("index.html not found in build directory");
  }

  console.log("✅ Frontend build successful");
  console.log(`   Generated ${buildFiles.length} files in build/`);
} catch (error) {
  console.error("❌ Frontend build failed:", error.message);
  process.exit(1);
}

// Test environment configuration
console.log("\n🔧 Testing environment configuration...");
process.chdir(path.join(__dirname, ".."));

const requiredEnvFiles = [
  ".env.example",
  ".env.production",
  "frontend/.env.production",
];

for (const envFile of requiredEnvFiles) {
  if (!fs.existsSync(envFile)) {
    console.error(`❌ Missing environment file: ${envFile}`);
    process.exit(1);
  }
}

console.log("✅ Environment configuration files present");

// Test deployment configuration files
console.log("\n📋 Testing deployment configuration...");

const deploymentFiles = [
  "railway.json",
  "render.yaml",
  "Dockerfile",
  ".dockerignore",
  "frontend/vercel.json",
  "frontend/netlify.toml",
  "frontend/_redirects",
  "DEPLOYMENT.md",
];

for (const deployFile of deploymentFiles) {
  if (!fs.existsSync(deployFile)) {
    console.error(`❌ Missing deployment file: ${deployFile}`);
    process.exit(1);
  }
}

console.log("✅ Deployment configuration files present");

// Test package.json scripts
console.log("\n📜 Testing package.json scripts...");

const backendPackage = JSON.parse(fs.readFileSync("package.json", "utf8"));
const frontendPackage = JSON.parse(
  fs.readFileSync("frontend/package.json", "utf8"),
);

const requiredBackendScripts = [
  "build",
  "build:clean",
  "start:prod",
  "deploy:build",
  "deploy:start",
];
const requiredFrontendScripts = ["build", "deploy:build"];

for (const script of requiredBackendScripts) {
  if (!backendPackage.scripts[script]) {
    console.error(`❌ Missing backend script: ${script}`);
    process.exit(1);
  }
}

for (const script of requiredFrontendScripts) {
  if (!frontendPackage.scripts[script]) {
    console.error(`❌ Missing frontend script: ${script}`);
    process.exit(1);
  }
}

console.log("✅ Package.json scripts configured correctly");

// Test TypeScript configuration
console.log("\n📝 Testing TypeScript configuration...");

const backendTsConfig = JSON.parse(fs.readFileSync("tsconfig.json", "utf8"));
const frontendTsConfig = JSON.parse(
  fs.readFileSync("frontend/tsconfig.json", "utf8"),
);

if (backendTsConfig.compilerOptions.outDir !== "./dist") {
  console.error("❌ Backend TypeScript outDir should be ./dist");
  process.exit(1);
}

if (!backendTsConfig.compilerOptions.strict) {
  console.error("❌ Backend TypeScript strict mode should be enabled");
  process.exit(1);
}

console.log("✅ TypeScript configuration valid");

console.log("\n🎉 All deployment compatibility tests passed!");
console.log("\nNext steps:");
console.log("1. Set up MongoDB Atlas database");
console.log("2. Configure Google OAuth credentials");
console.log("3. Deploy backend to Railway/Render");
console.log("4. Deploy frontend to Vercel/Netlify");
console.log("5. Update environment variables with production values");
console.log("6. Test the deployed application");
console.log("\nSee DEPLOYMENT.md for detailed instructions.");
