const express = require('express');
const bodyParser = require('body-parser');

const app = express();

class SmartContract {
  async checkHTLCTimeLimit() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(true); 
      }, 5000);
    });
  }

  async checkZeroKnowledgeProof() {
    return new Promise((resolve) => {
      resolve(true);
    });
  }
}

const conditionalTokenWrapperMiddleware = async (req, res, next) => {
  try {
    const {token} = req.body;

    const smartContract = new SmartContract();
    const htlcTimeLimitExceeded = await smartContract.checkHTLCTimeLimit();
    const zeroKnowledgeProofPassed = await smartContract.checkZeroKnowledgeProof();

    if (htlcTimeLimitExceeded && zeroKnowledgeProofPassed) {
      const userDecision = true;

      if (userDecision) {
        const wrappedToken = { token, context: { additionalInfo: "some context" } };
        res.status(200).json({ success: true, message: "Token wrapped successfully", data: wrappedToken });
      } else {
        res.status(400).json({ success: false, message: "User canceled wrapped token transaction" });
      }
    } else {
      res.status(400).json({ success: false, message: "Conditions for token wrapping not met" });
    }
  } catch (error) {
    console.error("Error during token wrapping:", error);
    res.status(500).json({ success: false, message: "Error during token wrapping" });
  }
};

app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.post('/wrap', conditionalTokenWrapperMiddleware);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server listening on port ${port}`))