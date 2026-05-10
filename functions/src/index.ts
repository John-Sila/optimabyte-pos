import * as functions from "firebase-functions";
import axios from "axios";

export const stkPush = functions.https.onRequest(async (req, res) => {
  try {
    const { phone, amount } = req.body;

    const consumerKey = "YOUR_KEY";
    const consumerSecret = "YOUR_SECRET";

    const auth = Buffer.from(
      `${consumerKey}:${consumerSecret}`
    ).toString("base64");

    const tokenResponse = await axios.get(
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      }
    );

    const accessToken = tokenResponse.data.access_token;

    const timestamp = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, "")
      .slice(0, 14);

    const shortcode = "174379";
    const passkey = "YOUR_PASSKEY";

    const password = Buffer.from(
      `${shortcode}${passkey}${timestamp}`
    ).toString("base64");

    const response = await axios.post(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: amount,
        PartyA: phone,
        PartyB: shortcode,
        PhoneNumber: phone,
        CallBackURL: "https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/mpesaCallback",
        AccountReference: "OptimaPOS",
        TransactionDesc: "Payment",
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    res.json(response.data);
  } catch (err: any) {
    console.error(err.response?.data || err);
    res.status(500).json({
      error: err.message,
    });
  }
});
