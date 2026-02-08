import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

/*
  Request Interceptor
  Har request ke sath token automatically jayega
*/
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/*
  Response Interceptor
  Future me 401, 403 handle kar sakte hain
*/
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // optional: logout on token expire later
    return Promise.reject(error);
  }
);

export default api;
