import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      setToken(storedToken);
      checkAuthStatus();
    } else {
      console.log('No token found in localStorage');
      setLoading(false);
    }
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('No token available for auth check');
        setUser(null);
        setLoading(false);
        return;
      }

      console.log('Checking auth status with token:', token.substring(0, 10) + '...');
      const response = await axios.get('http://localhost:8000/me', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      if (response.data) {
        console.log('Auth check successful, user:', response.data);
        setUser(response.data);
      } else {
        console.log('Auth check returned no user data');
        localStorage.removeItem('token');
        setUser(null);
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      if (err.response?.status === 401) {
        console.log('Token expired or invalid, removing from localStorage');
        localStorage.removeItem('token');
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      setError(null);
      console.log('Attempting login for user:', username);
      
      const formData = new FormData();
      formData.append('username', username);
      formData.append('password', password);

      const response = await axios.post('http://localhost:8000/token', formData);
      const { access_token, user: userData } = response.data;
      
      console.log('Login successful, saving token');
      localStorage.setItem('token', access_token);
      setToken(access_token);
      setUser(userData);
      return true;
    } catch (err) {
      console.error('Login failed:', err);
      setError(err.response?.data?.detail || 'Login failed');
      return false;
    }
  };

  const register = async (username, password) => {
    try {
      setError(null);
      const response = await axios.post('http://localhost:8000/register', {
        username,
        password,
        confirm_password: password
      });
      return true;
    } catch (err) {
      if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else if (err.response?.data) {
        // Handle validation errors
        const validationErrors = Object.values(err.response.data)
          .flat()
          .map(error => error.msg || error)
          .join(', ');
        setError(validationErrors);
      } else {
        setError('Registration failed');
      }
      return false;
    }
  };

  const logout = () => {
    console.log('Logging out user');
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    checkAuthStatus,
    token,
    setToken
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 