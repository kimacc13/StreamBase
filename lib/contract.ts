export const CONTRACT_ADDRESS = '0x8536B473F4d2B2eeD9a8FE3A2201637dA5Cf0787' as const

export const CONTRACT_ABI = [
  'function owner() view returns (address)',
  'function deposit() payable',
  'function addEmployee(address _employee, uint256 _salaryPerMonth)',
  'function removeEmployee(address _employee)',
  'function getEarnedSalary(address _employee) view returns (uint256)',
  'function withdrawSalary()',
  'function ownerWithdraw(uint256 amount)',
  'function getContractBalance() view returns (uint256)',
  'function getEmployee(address _employee) view returns (uint256 salaryPerMonth, uint256 startTime, uint256 earned, bool active)',
  'function getEmployeeCount() view returns (uint256)',
  'event EmployeeAdded(address indexed employee, uint256 salaryPerMonth)',
  'event EmployeeRemoved(address indexed employee)',
  'event SalaryWithdrawn(address indexed employee, uint256 amount)',
  'event OwnerWithdraw(uint256 amount)',
  'event Deposited(address indexed from, uint256 amount)',
] as const
