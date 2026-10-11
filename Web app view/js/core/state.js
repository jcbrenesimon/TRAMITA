// Estado global
let currentUser = null;
let currentProfile = null;
let settings = {};
let categories = [];
let services = [];
let paymentAccounts = [];
let currentService = null;
let currentCat = 'all';
let cart = JSON.parse(localStorage.getItem('tramita_cart') || '[]');
let selectedPaymentAccountId = null;
let appliedCoupon = null;
let pendingReceiptFile = null;
let currentOrder = null;

