// ============ ESTADO GLOBAL ============
let currentUser = null;
let currentProfile = null;
let currentView = 'dashboard';
let ordersFilter = 'all';
let ordersSearch = '';
let ordersPage = 0;
let usersFilter = 'all';
let usersSearch = '';
let usersPage = 0;

const isAdmin = () => currentProfile?.role === 'admin';
const canOperate = () => ['admin', 'operador'].includes(currentProfile?.role);
