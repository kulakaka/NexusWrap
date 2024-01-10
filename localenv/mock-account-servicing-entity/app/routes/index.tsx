import { json } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import { getAccountsWithBalance } from '../lib/balances.server'
import tableStyle from '../styles/table.css'

type LoaderData = {
  accountsWithBalance: Awaited<ReturnType<typeof getAccountsWithBalance>>
}

export const loader = async () => {
  return json<LoaderData>({
    accountsWithBalance: await getAccountsWithBalance()
  })
}

export default function Accounts() {
  const { accountsWithBalance } = useLoaderData() as LoaderData
  return (
    <main>
      <h1>Accounts</h1>
      <table>
        <tr>
          <th>#</th>
          <th>Account Name</th>
          <th>Wallet Address</th>
          <th>Balance</th>
        </tr>
        {accountsWithBalance.map((acc, i) => (
          <tr key={acc.id}>
            <td>{i + 1}</td>
            <td>
              <Link to={`/accounts/${acc.id}`}>{acc.name}</Link>
            </td>
            <td>{acc.walletAddress}</td>
            <td>
              {(Number(acc.balance) / 100).toFixed(acc.assetScale)}{' '}
              {acc.assetCode}
            </td>
          </tr>
        ))}
      </table>
    </main>
  )
}

export function links() {
  return [{ rel: 'stylesheet', href: tableStyle }]
}
