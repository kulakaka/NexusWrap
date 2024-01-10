// Import Web3
const Web3 = require('web3');

// Initialize Web3 instance with MetaMask provider
if (window.ethereum) {
    const web3 = new Web3(window.ethereum);
    try {
        // Request account access if needed
        await window.ethereum.enable();
        // Accounts now exposed

        let accounts=  await web3.eth.getAccounts();
        let fromAddress = accounts[0];


    } catch (error) {
        console.error("User denied account access");
    }
} else {
    console.log('Non-Ethereum browser detected. You should consider trying MetaMask!');
}
