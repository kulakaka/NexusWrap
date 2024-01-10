async function connectWallet() {
    
    if (typeof window.ethereum !== 'undefined' || (typeof window.web3 !== 'undefined')) {
        // MetaMask is installed
        connectMetaMask();  
    } else {
        // MetaMask is not installed, ask the user to install it
        console.log('Please install Metamask on your browser');
    }  
}


async function connectMetaMask() {
    try {
        // Request account access if needed
        const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
        
        // We now have the user's account address
        const account = accounts[0];
        console.log('Connected account:', account);

        window.location.href='/transection.html';

    } catch (error) {
        // User denied account access...
        console.error('User denied account access');
    }
}
