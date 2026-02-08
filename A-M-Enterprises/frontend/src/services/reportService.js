import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:5000/api",
});

API.interceptors.request.use((req) => {
  const token = localStorage.getItem("token");
  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

export const getDailySummary = async () => {
  const { data } = await API.get("/reports/daily-summary");
  return data;
};

export const fetchDueReport = async () => {
  const { data } = await API.get("/reports/due");
  return data;
};
