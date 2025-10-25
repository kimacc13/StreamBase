'use client'

import { useAccount, useConnect, useDisconnect, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { parseEther, formatEther } from 'viem'
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '@/lib/contract'
import { useState, useEffect } from 'react'
import { base } from 'wagmi/chains'

export default function Home() {
  const { address, isConnected, chain } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()
  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const [depositAmount, setDepositAmount] = useState('')
  const [employeeAddress, setEmployeeAddress] = useState('')
  const [salaryAmount, setSalaryAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')

  // Read contract data
  const { data: owner } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'owner',
  })

  const { data: contractBalance, refetch: refetchBalance } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getContractBalance',
  })

  const { data: employeeData, refetch: refetchEmployee } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getEmployee',
    args: address ? [address] : undefined,
  })

  const { data: earnedSalary, refetch: refetchEarned } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getEarnedSalary',
    args: address ? [address] : undefined,
  })

  // Auto switch to Base Mainnet when connected
  useEffect(() => {
    if (isConnected && chain && chain.id !== base.id) {
      switchChain({ chainId: base.id })
    }
  }, [isConnected, chain, switchChain])

  // Refresh data every 5 seconds
  useEffect(() => {
    if (!isConnected) return
    const interval = setInterval(() => {
      refetchBalance()
      refetchEmployee()
      refetchEarned()
    }, 5000)
    return () => clearInterval(interval)
  }, [isConnected, refetchBalance, refetchEmployee, refetchEarned])

  // Refetch after successful transaction
  useEffect(() => {
    if (isSuccess) {
      refetchBalance()
      refetchEmployee()
      refetchEarned()
    }
  }, [isSuccess, refetchBalance, refetchEmployee, refetchEarned])

  const isOwner = address && owner && address.toLowerCase() === (owner as string).toLowerCase()
  const isEmployee = employeeData && (employeeData as any)[3] // active status

  const handleDeposit = () => {
    if (!depositAmount) return
    console.log('Attempting deposit:', depositAmount, 'ETH')
    console.log('Chain ID:', chain?.id)
    console.log('Expected Chain ID:', base.id)
    console.log('Contract Address:', CONTRACT_ADDRESS)
    console.log('Is Connected:', isConnected)
    console.log('User Address:', address)

    if (chain?.id !== base.id) {
      alert('Please switch to Base Mainnet')
      return
    }

    try {
      const value = parseEther(depositAmount)
      console.log('Parsed value:', value.toString())

      writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'deposit',
        value: value,
      })

      console.log('writeContract called')
      setDepositAmount('')
    } catch (error) {
      console.error('Error calling writeContract:', error)
      alert('Error: ' + (error as Error).message)
    }
  }

  const handleAddEmployee = () => {
    if (!employeeAddress || !salaryAmount) return
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'addEmployee',
      args: [employeeAddress, parseEther(salaryAmount)],
    })
    setEmployeeAddress('')
    setSalaryAmount('')
  }

  const handleWithdrawSalary = () => {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'withdrawSalary',
    })
  }

  const handleOwnerWithdraw = () => {
    if (!withdrawAmount) return
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'ownerWithdraw',
      args: [parseEther(withdrawAmount)],
    })
    setWithdrawAmount('')
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-base-lightblue to-white">
      {/* Header */}
      <header className="bg-base-blue text-white p-6 shadow-lg">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-3xl font-bold">BaseStream</h1>
          <div className="flex items-center gap-4">
            {isConnected ? (
              <>
                <div className="bg-white/20 px-4 py-2 rounded-lg">
                  <p className="text-sm font-mono">{address?.slice(0, 6)}...{address?.slice(-4)}</p>
                </div>
                <button
                  onClick={() => disconnect()}
                  className="bg-white text-base-blue px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 transition"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                onClick={() => connectors[0] && connect({ connector: connectors[0] })}
                className="bg-white text-base-blue px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 transition"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-8">
        {!isConnected ? (
          <div className="text-center py-20">
            <h2 className="text-4xl font-bold text-gray-800 mb-4">Welcome to BaseStream</h2>
            <p className="text-xl text-gray-600 mb-8">Stream salaries on Base blockchain in real-time</p>
            <button
              onClick={() => connectors[0] && connect({ connector: connectors[0] })}
              className="bg-base-blue text-white px-8 py-4 rounded-lg font-semibold text-lg hover:opacity-90 transition"
            >
              Connect Wallet to Start
            </button>
          </div>
        ) : (
          <>
            {/* Contract Balance */}
            <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
              <h3 className="text-xl font-bold text-gray-800 mb-2">Contract Balance</h3>
              <p className="text-3xl font-bold text-base-blue">
                {contractBalance ? formatEther(contractBalance as bigint) : '0'} ETH
              </p>
            </div>

            {/* Owner Dashboard */}
            {isOwner && (
              <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-3">Owner Dashboard</h2>

                {/* Deposit Funds */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-3">Deposit Funds</h3>
                  <div className="flex gap-3">
                    <input
                      type="number"
                      step="0.001"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="Amount in ETH"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-base-blue"
                    />
                    <button
                      onClick={handleDeposit}
                      disabled={isPending || isConfirming || !depositAmount}
                      className="bg-base-blue text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {isPending || isConfirming ? 'Processing...' : 'Deposit'}
                    </button>
                  </div>
                </div>

                {/* Add Employee */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-3">Add Employee</h3>
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={employeeAddress}
                      onChange={(e) => setEmployeeAddress(e.target.value)}
                      placeholder="Employee Address"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-base-blue"
                    />
                    <div className="flex gap-3">
                      <input
                        type="number"
                        step="0.001"
                        value={salaryAmount}
                        onChange={(e) => setSalaryAmount(e.target.value)}
                        placeholder="Monthly Salary in ETH"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-base-blue"
                      />
                      <button
                        onClick={handleAddEmployee}
                        disabled={isPending || isConfirming || !employeeAddress || !salaryAmount}
                        className="bg-base-blue text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
                      >
                        {isPending || isConfirming ? 'Processing...' : 'Add Employee'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Owner Withdraw */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Withdraw Idle Funds (12h delay)</h3>
                  <div className="flex gap-3">
                    <input
                      type="number"
                      step="0.001"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="Amount in ETH"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-base-blue"
                    />
                    <button
                      onClick={handleOwnerWithdraw}
                      disabled={isPending || isConfirming || !withdrawAmount}
                      className="bg-base-blue text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {isPending || isConfirming ? 'Processing...' : 'Withdraw'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Employee Dashboard */}
            {isEmployee && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-3">Employee Dashboard</h2>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm text-gray-600 mb-1">Monthly Salary</h3>
                    <p className="text-2xl font-bold text-gray-800">
                      {employeeData ? formatEther((employeeData as any)[0]) : '0'} ETH
                    </p>
                  </div>

                  <div>
                    <h3 className="text-sm text-gray-600 mb-1">Earned (Available to Withdraw)</h3>
                    <p className="text-3xl font-bold text-base-blue">
                      {earnedSalary ? formatEther(earnedSalary as bigint) : '0'} ETH
                    </p>
                  </div>

                  <button
                    onClick={handleWithdrawSalary}
                    disabled={isPending || isConfirming || !earnedSalary || earnedSalary === 0n}
                    className="w-full bg-base-blue text-white px-6 py-3 rounded-lg font-semibold text-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {isPending || isConfirming ? 'Processing...' : 'Withdraw Salary'}
                  </button>

                  {earnedSalary === 0n && (
                    <p className="text-center text-gray-500 text-sm">No salary earned yet. Please wait for time to pass.</p>
                  )}
                </div>
              </div>
            )}

            {/* Public Dashboard - Anyone can deposit */}
            {!isOwner && !isEmployee && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-3">Public Dashboard</h2>
                <p className="text-gray-600 mb-6">You can deposit funds to support the contract.</p>

                {/* Deposit Funds */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Deposit Funds</h3>
                  <div className="flex gap-3">
                    <input
                      type="number"
                      step="0.001"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="Amount in ETH"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-base-blue"
                    />
                    <button
                      onClick={handleDeposit}
                      disabled={isPending || isConfirming || !depositAmount}
                      className="bg-base-blue text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {isPending || isConfirming ? 'Processing...' : 'Deposit'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Transaction Status */}
            {(isPending || isConfirming) && (
              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 font-semibold">
                  {isPending && 'Waiting for wallet confirmation...'}
                  {isConfirming && 'Transaction confirming...'}
                </p>
              </div>
            )}

            {isSuccess && (
              <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800 font-semibold">Transaction successful!</p>
                {hash && (
                  <a
                    href={`https://basescan.org/tx/${hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-sm"
                  >
                    View on BaseScan
                  </a>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
