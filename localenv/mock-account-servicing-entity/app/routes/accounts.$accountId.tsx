import { json } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { getAccountTransactions } from '../lib/transactions.server'
import tableStyle from '../styles/table.css'

type LoaderData = {
  transactions: Awaited<ReturnType<typeof getAccountTransactions>>
}

export const loader = async ({ params }) => {
  return json<LoaderData>({
    transactions: await getAccountTransactions(params.accountId)
  })
}

export default function Transactions() {
  const { transactions } = useLoaderData() as LoaderData
  return (
    <main>
      <h1>Transactions</h1>
      <table>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>Metadata</th>
          <th>Amount</th>
        </tr>
        {transactions.map((trx) => (
          <tr key={trx.id}>
            <td>{trx.createdAt}</td>
            <td>{trx.type}</td>
            <td>
              <code>{JSON.stringify(trx.metadata)}</code>
            </td>
            <td>
              {(Number(trx.amountValue) / 100).toFixed(trx.assetScale)}{' '}
              {trx.assetCode}
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
