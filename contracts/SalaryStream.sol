// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SalaryStream {
    address public owner;
    uint256 public constant WITHDRAW_DELAY = 12 hours;
    uint256 public lastWithdrawTime;

    struct Employee {
        uint256 salaryPerSecond; // Salary rate per second
        uint256 startTime; // When employee started
        uint256 lastWithdrawTime; // Last time employee withdrew
        bool active; // Is employee active
    }

    mapping(address => Employee) public employees;
    address[] public employeeList;

    event EmployeeAdded(address indexed employee, uint256 salaryPerMonth);
    event EmployeeRemoved(address indexed employee);
    event SalaryWithdrawn(address indexed employee, uint256 amount);
    event OwnerWithdraw(uint256 amount);
    event Deposited(address indexed from, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }

    constructor() {
        owner = msg.sender;
        lastWithdrawTime = block.timestamp;
    }

    // Employer deposits funds
    function deposit() external payable {
        require(msg.value > 0, "Must deposit some ETH");
        emit Deposited(msg.sender, msg.value);
    }

    // Add employee with monthly salary
    function addEmployee(address _employee, uint256 _salaryPerMonth) external onlyOwner {
        require(_employee != address(0), "Invalid address");
        require(!employees[_employee].active, "Employee already exists");

        // Convert monthly salary to per-second rate
        // 30 days * 24 hours * 60 minutes * 60 seconds = 2,592,000 seconds
        uint256 salaryPerSecond = _salaryPerMonth / 2592000;

        employees[_employee] = Employee({
            salaryPerSecond: salaryPerSecond,
            startTime: block.timestamp,
            lastWithdrawTime: block.timestamp,
            active: true
        });

        employeeList.push(_employee);
        emit EmployeeAdded(_employee, _salaryPerMonth);
    }

    // Remove employee
    function removeEmployee(address _employee) external onlyOwner {
        require(employees[_employee].active, "Employee not found");
        employees[_employee].active = false;
        emit EmployeeRemoved(_employee);
    }

    // Calculate earned salary
    function getEarnedSalary(address _employee) public view returns (uint256) {
        Employee memory emp = employees[_employee];
        if (!emp.active) return 0;

        uint256 timeWorked = block.timestamp - emp.lastWithdrawTime;
        return timeWorked * emp.salaryPerSecond;
    }

    // Employee withdraws earned salary
    function withdrawSalary() external {
        Employee storage emp = employees[msg.sender];
        require(emp.active, "Not an active employee");

        uint256 earned = getEarnedSalary(msg.sender);
        require(earned > 0, "No salary to withdraw");
        require(address(this).balance >= earned, "Insufficient contract balance");

        emp.lastWithdrawTime = block.timestamp;

        (bool success, ) = payable(msg.sender).call{value: earned}("");
        require(success, "Transfer failed");

        emit SalaryWithdrawn(msg.sender, earned);
    }

    // Owner withdraws idle funds (12 hour delay)
    function ownerWithdraw(uint256 amount) external onlyOwner {
        require(block.timestamp >= lastWithdrawTime + WITHDRAW_DELAY, "Must wait 12 hours");
        require(address(this).balance >= amount, "Insufficient balance");

        lastWithdrawTime = block.timestamp;

        (bool success, ) = payable(owner).call{value: amount}("");
        require(success, "Transfer failed");

        emit OwnerWithdraw(amount);
    }

    // Get contract balance
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // Get employee info
    function getEmployee(address _employee) external view returns (
        uint256 salaryPerMonth,
        uint256 startTime,
        uint256 earned,
        bool active
    ) {
        Employee memory emp = employees[_employee];
        return (
            emp.salaryPerSecond * 2592000, // Convert back to monthly
            emp.startTime,
            getEarnedSalary(_employee),
            emp.active
        );
    }

    // Get all employees
    function getEmployeeCount() external view returns (uint256) {
        return employeeList.length;
    }

    receive() external payable {
        emit Deposited(msg.sender, msg.value);
    }
}
