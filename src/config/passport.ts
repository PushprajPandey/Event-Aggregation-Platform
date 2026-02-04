import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { config } from "./environment";
import { User } from "../models/User";
import { IUser } from "../types";

// Configure Google OAuth2 Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: config.auth.googleClientId,
      clientSecret: config.auth.googleClientSecret,
      callbackURL: "/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user already exists
        let user = await User.findByGoogleId(profile.id);

        if (user) {
          // Update last login time for existing user
          await user.updateLastLogin();
          return done(null, user);
        }

        // Create new user from Google profile
        user = await User.createFromGoogleProfile(profile);
        return done(null, user);
      } catch (error) {
        console.error("Google OAuth error:", error);
        return done(error, false);
      }
    },
  ),
);

// Serialize user for session storage
passport.serializeUser((user: IUser, done) => {
  done(null, user._id.toString());
});

// Deserialize user from session
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    console.error("User deserialization error:", error);
    done(error, null);
  }
});

export { passport };
