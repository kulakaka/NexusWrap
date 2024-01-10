import { useLocation } from '@remix-run/react'
import type { Dispatch, SetStateAction } from 'react'
import { useEffect, useState } from 'react'
import { ApiClient } from '~/lib/apiClient'
import type { Access } from '~/lib/types'
import { parseQueryString } from '~/lib/utils'

interface ConsentScreenContext {
  ready: boolean
  thirdPartyName: string
  thirdPartyUri: string
  interactId: string
  nonce: string
  returnUrl: string
  accesses: Array<Access> | null
  outgoingPaymentAccess: Access | null
  price: GrantAmount | null
  costToUser: GrantAmount | null
  errors: Array<Error>
}

interface GrantAmount {
  amount: number
  currencyDisplayCode: string
}

function ConsentScreenBody({
  thirdPartyUri,
  thirdPartyName,
  price,
  costToUser,
  interactId,
  nonce,
  returnUrl
}: {
  thirdPartyUri: string
  thirdPartyName: string
  price: GrantAmount
  costToUser: GrantAmount
  interactId: string
  nonce: string
  returnUrl: string
}) {
  const chooseConsent = (accept: boolean) => {
    const href = new URL(returnUrl)
    href.searchParams.append('interactId', interactId)
    href.searchParams.append('nonce', nonce)
    href.searchParams.append('decision', accept ? 'accept' : 'reject')
    window.location.href = href.toString()
  }

  const thirdPartyUrl = new URL(thirdPartyUri)
  const thirdPartyOrigin = thirdPartyUrl.origin

  return (
    <>
      <div className='row'>
        <div className='col-12'>
          <img
            src={`${thirdPartyOrigin}/favicon.ico`}
            style={{ width: '167px' }}
            alt=''
          ></img>
          <img src='/wallet-logo.png' style={{ width: '167px' }} alt=''></img>
        </div>
      </div>
      <div className='row mt-2'>
        <div className='col-12'>
          {price ? (
            <p>
              {thirdPartyName} wants to send {price.currencyDisplayCode}{' '}
              {price.amount.toFixed(2)} to its account.
            </p>
          ) : (
            <></>
          )}
        </div>
      </div>
      <div className='row mt-2'>
        <div className='col-12'>
          {costToUser ? (
            <p>
              This will cost you {costToUser.currencyDisplayCode}{' '}
              {costToUser.amount.toFixed(2)}
            </p>
          ) : (
            <></>
          )}
        </div>
      </div>
      <div className='row mt-2'>
        <div className='col-12'>Do you consent?</div>
      </div>
      <div className='row mt-2'>
        <div className='col-12 px-4 mr-3'>
          <button
            className='btn btn-success btn-lg me-2'
            onClick={() => chooseConsent(true)}
          >
            Yes
          </button>
          <button
            className='btn btn-outline-danger btn-lg me-2'
            onClick={() => chooseConsent(false)}
          >
            No
          </button>
        </div>
      </div>
    </>
  )
}

function PreConsentScreen({
  ctx,
  setCtx
}: {
  ctx: ConsentScreenContext
  setCtx: Dispatch<SetStateAction<ConsentScreenContext>>
}) {
  return (
    <>
      <div className='row mt-2'>
        <div className='col-12 text-start'>
          <h5 className='display-6'>Mock Identity Provider</h5>
        </div>
      </div>
      <div className='row'>
        <div className='col-12 text-start'>
          <form>
            <div className='form-group mt-3'>
              <label
                htmlFor='pre-consent-screen-interactId'
                style={{ display: 'block' }}
              >
                interactId
              </label>
              <input
                className='form-control'
                id='pre-consent-screen-interactId'
                type='text'
                spellCheck={false}
                value={ctx.interactId}
                onChange={(event) => {
                  setCtx({
                    ...ctx,
                    interactId: event.target.value
                  })
                }}
              ></input>
            </div>
            <div className='form-group mt-3'>
              <label
                htmlFor='pre-consent-screen-nonce'
                style={{ display: 'block' }}
              >
                nonce
              </label>
              <input
                className='form-control'
                id='pre-consent-screen-nonce'
                type='text'
                spellCheck={false}
                value={ctx.nonce}
                onChange={(event) => {
                  setCtx({
                    ...ctx,
                    nonce: event.target.value
                  })
                }}
              ></input>
            </div>
            <div className='form-group mt-3'>
              <label
                htmlFor='pre-consent-screen-return-url'
                style={{ display: 'block' }}
              >
                return url
              </label>
              <input
                className='form-control'
                id='pre-consent-screen-return-url'
                type='text'
                spellCheck={false}
                value={ctx.returnUrl}
                onChange={(event) => {
                  setCtx({
                    ...ctx,
                    returnUrl: event.target.value
                  })
                }}
              ></input>
            </div>
          </form>
        </div>
      </div>
      <div className='row mt-2'>
        <div className='col-12 text-start'>
          <button
            className='btn btn-primary'
            disabled={!ctx.interactId || !ctx.nonce || !ctx.returnUrl}
            onClick={() => {
              setCtx({
                ...ctx,
                ready: true
              })
            }}
          >
            Begin
          </button>
        </div>
      </div>
    </>
  )
}

export default function ConsentScreen() {
  const [ctx, setCtx] = useState({
    ready: false,
    thirdPartyName: '',
    thirdPartyUri: '',
    interactId: 'demo-interact-id',
    nonce: 'demo-interact-nonce',
    returnUrl: 'http://localhost:3030/shoe-shop?',
    //TODO returnUrl: 'http://localhost:3030/shoe-shop?interactid=demo-interact-id&nonce=demo-interact-nonce',
    accesses: null,
    outgoingPaymentAccess: null,
    price: null,
    costToUser: null,
    errors: new Array<Error>()
  } as ConsentScreenContext)
  const location = useLocation()
  const queryParams = parseQueryString(location.search)

  useEffect(() => {
    if (
      ctx.errors.length === 0 &&
      !ctx.ready &&
      queryParams.has('interactId', 'nonce')
    ) {
      const interactId = queryParams.getAsString('interactId')
      const nonce = queryParams.getAsString('nonce')
      const returnUrl = queryParams.getAsString('returnUrl')
      const clientName = queryParams.getAsString('clientName') as string
      const clientUri = queryParams.getAsString('clientUri') as string
      if (interactId && nonce) {
        setCtx({
          ...ctx,
          ready: true,
          interactId,
          nonce,
          returnUrl: returnUrl || ctx.returnUrl,
          thirdPartyName: clientName,
          thirdPartyUri: clientUri
        })
      }
    }
  }, [ctx, setCtx, queryParams])

  useEffect(() => {
    if (ctx.errors.length === 0 && ctx.ready && !ctx.accesses) {
      const { interactId, nonce } = ctx

      ApiClient.getGrant({
        interactId,
        nonce
      })
        .then((response) => {
          if (response.isFailure) {
            setCtx({
              ...ctx,
              errors: response.errors.map((e) => new Error(e))
            })
          } else if (!response.payload) {
            setCtx({
              ...ctx,
              errors: [new Error('no accesses in grant')]
            })
          } else {
            const outgoingPaymentAccess =
              response.payload.find((p) => p.type === 'outgoing-payment') ||
              null
            const returnUrlObject = new URL(ctx.returnUrl)
            returnUrlObject.searchParams.append(
              'grantId',
              outgoingPaymentAccess.grantId
            )
            returnUrlObject.searchParams.append(
              'thirdPartyName',
              ctx.thirdPartyName
            )
            returnUrlObject.searchParams.append(
              'thirdPartyUri',
              ctx.thirdPartyUri
            )
            returnUrlObject.searchParams.append(
              'currencyDisplayCode',
              outgoingPaymentAccess && outgoingPaymentAccess.limits
                ? outgoingPaymentAccess.limits.debitAmount.assetCode
                : null
            )
            returnUrlObject.searchParams.append(
              'sendAmountValue',
              outgoingPaymentAccess && outgoingPaymentAccess.limits
                ? outgoingPaymentAccess.limits.debitAmount.value
                : null
            )
            returnUrlObject.searchParams.append(
              'sendAmountScale',
              outgoingPaymentAccess && outgoingPaymentAccess.limits
                ? outgoingPaymentAccess.limits.debitAmount.assetScale
                : null
            )
            setCtx({
              ...ctx,
              accesses: response.payload,
              outgoingPaymentAccess: outgoingPaymentAccess,
              thirdPartyName: ctx.thirdPartyName,
              thirdPartyUri: ctx.thirdPartyUri,
              returnUrl: returnUrlObject.toString()
            })
          }
        })
        .catch((err) => {
          setCtx({
            ...ctx,
            errors: [err]
          })
        })
    }
  }, [ctx, setCtx])

  useEffect(() => {
    if (
      ctx.errors.length === 0 &&
      ctx.ready &&
      ctx.outgoingPaymentAccess &&
      (!ctx.price || !ctx.costToUser)
    ) {
      if (
        ctx.outgoingPaymentAccess.limits &&
        ctx.outgoingPaymentAccess.limits.debitAmount &&
        ctx.outgoingPaymentAccess.limits.receiveAmount
      ) {
        const { receiveAmount, debitAmount } = ctx.outgoingPaymentAccess.limits
        setCtx({
          ...ctx,
          price: {
            amount:
              Number(receiveAmount.value) /
              Math.pow(10, receiveAmount.assetScale),
            currencyDisplayCode: receiveAmount.assetCode
          },
          costToUser: {
            amount:
              Number(debitAmount.value) / Math.pow(10, debitAmount.assetScale),
            currencyDisplayCode: debitAmount.assetCode
          }
        })
      } else {
        setCtx({
          ...ctx,
          errors: [new Error('missing or incomplete outgoing payment access')]
        })
      }
    }
  }, [ctx, setCtx])

  return (
    <>
      <div
        style={{
          background:
            'linear-gradient(0deg, rgba(9,9,121,0.8) 0%, rgba(193,1,250,0.8) 50%, rgba(9,9,121,0.8) 100%)',
          position: 'fixed',
          left: 0,
          top: 0,
          zIndex: -1,
          width: '100%',
          height: '100%',
          opacity: '0.25',
          filter: 'sepia(0.75)'
        }}
      >
        &nbsp;
      </div>
      <div style={{ padding: '1em' }}>
        <div className='card text-center mx-auto mt-3 w-50 p-3 justify-center'>
          <div className='card-body d-grid gap-3'>
            {ctx.ready ? (
              <>
                {ctx.errors.length > 0 || !ctx.price || !ctx.costToUser ? (
                  <>
                    <h2 className='display-6'>Failed</h2>
                    <ul>
                      {ctx.errors.map((e, ei) => (
                        <li className='text-danger' key={ei}>
                          {e.message}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <ConsentScreenBody
                    thirdPartyUri={ctx.thirdPartyUri}
                    thirdPartyName={ctx.thirdPartyName}
                    price={ctx.price}
                    costToUser={ctx.costToUser}
                    interactId={ctx.interactId}
                    nonce={ctx.nonce}
                    returnUrl={ctx.returnUrl}
                  />
                )}
              </>
            ) : (
              <PreConsentScreen ctx={ctx} setCtx={setCtx} />
            )}
          </div>
        </div>
      </div>
    </>
  )
}
