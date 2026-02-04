import axios from 'axios';
import { User } from '../types/admin';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

const authApi = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Important for session cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

class AuthService {
  /**
   * Initiate Google OAuth login
   */
  loginWithGoogle(): void {
    // Redirect to backend Google OAuth endpoint
    window.location.href = `${API_BASE_URL}/auth/google`;
  }

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    try {
      await authApi.get('/auth/logout');
      // Clear any local auth state if needed
      localStorage.removeItem('user');
    } catch (error) {
      console.error('Error logging out:', error);
      throw error;
    }
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      const response = await authApi.get<{ success: boolean; data?: { user: User } }>('/auth/current');
      
      if (response.data.success && response.data.data?.user) {
        const user = response.data.data.user;
        // Cache user in localStorage for quick access
        localStorage.setItem('user', JSON.stringify(user));
        return user;
      }
      
      localStorage.removeItem('user');
      return null;
    } catch (error) {
      console.error('Error fetching current user:', error);
      localStorage.removeItem('user');
      return null;
    }
  }

  /**
   * Check if user is authenticated (from cache first)
   */
  isAuthenticated(): boolean {
    const user = localStorage.getItem('user');
    return user !== null;
  }

  /**
   * Get cached user data
   */
  getCachedUser(): User | null {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }
}

export const authService = new AuthService();
export default authService;
