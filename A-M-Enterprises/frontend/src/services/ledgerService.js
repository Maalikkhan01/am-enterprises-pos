import api from "./api";

export const receivePayment = async (payload) => {
  const { data } = await api.post("/ledger/receive-payment", payload);
  return data;
};
