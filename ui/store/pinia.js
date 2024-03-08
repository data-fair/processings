import { jwtDecode } from 'jwt-decode'
import { defineStore } from 'pinia'

function goTo(url) {
  try {
    window.top.location.href = url
  } catch (err) {
    console.error('Failed to navigate in top window')
    window.location.href = url
  }
}

function jwtDecodeAlive(jwt) {
  if (!jwt) {
    return null
  }
  const decoded = jwtDecode(jwt)
  if (!decoded) {
    return null
  }
  const now = Math.ceil(Date.now().valueOf() / 1000)
  if (typeof decoded.exp !== 'undefined' && decoded.exp < now) {
    console.error(`token expired: ${decoded.exp}<${now},  ${JSON.stringify(decoded)}`)
    return null
  }
  if (typeof decoded.nbf !== 'undefined' && decoded.nbf > now) {
    console.warn(`token not yet valid: ${decoded.nbf}>${now}, ${JSON.stringify(decoded)}`)
    // do not return null here, this is probably a false flag due to a slightly mismatched clock
    // return null
  }
  return decoded
}

export function sessionPiniaStoreBuilder(overrideConfig = {}) {
  overrideConfig = {
    state: overrideConfig.state ? overrideConfig.state : () => ({}),
    getters: overrideConfig.getters || {},
    actions: overrideConfig.actions || {}
  }

  const storeDefinition = defineStore('session', {
    state: () => ({
      activeAccountDetails: null,
      autoKeepalive: 0,
      cookieName: 'id_token',
      directoryUrl: null,
      initialized: false,
      interval: 10000,
      logoutRedirectUrl: null,
      reloadAfterLogout: true,
      reloadAfterSwitchOrganization: true,
      sameSite: null,
      user: null,
      ...overrideConfig.state()
    }),
    getters: {
      accountRole() {
        if (!this.user) {
          return null
        }
        if (this.user.organization) {
          return this.user.organization.role
        }
        return 'admin'
      },
      activeAccount() {
        if (!this.user) {
          return null
        }
        if (this.user.organization) {
          const account = {
            type: 'organization',
            id: this.user.organization.id,
            name: this.user.organization.name
          }
          if (this.user.organization.department) {
            account.department = this.user.organization.department
          }
          if (this.user.organization.departmentName) {
            account.departmentName = this.user.organization.departmentName
          }
          return account
        }
        return {
          type: 'user',
          id: this.user.id,
          name: this.user.name
        }
      },
      cookieOpts() {
        return { path: '/', sameSite: this.sameSite }
      },
      isAccountAdmin() {
        return this.user.adminMode === true
      },
      loginUrl() {
        return (redirect, noImmediate, extraParams = {}) => {
          // Login can also be used to redirect user immediately if he is already logged
          // shorter than "logIfNecessaryOrRedirect"
          if (redirect && this.user && !noImmediate) {
            return redirect
          }
          if (!redirect || typeof redirect !== 'string') {
            redirect = window.location ? `${window.location.href}` : ''
          }
          let url = `${this.directoryUrl}/login?redirect=${encodeURIComponent(redirect)}`
          Object.keys(extraParams).filter(key => ![null, undefined, ''].includes(extraParams[key])).forEach(key => {
            url += `&${key}=${encodeURIComponent(extraParams[key])}`
          })
          return url
        }
      },
      ...overrideConfig.getters
    },
    actions: {
      asAdmin(user) {
        if (this.httpLib) {
          if (user) {
            this.httpLib(`${this.directoryUrl}/api/auth/asadmin`, {
              method: 'POST',
              body: { ...user }
            }).then(() => {
              this.readCookie()
              goTo(this.logoutRedirectUrl || '/')
            })
          } else {
            this.httpLib(`${this.directoryUrl}/api/auth/asadmin`, {
              method: 'DELETE'
            }).then(() => {
              this.readCookie()
              goTo(this.logoutRedirectUrl || '/')
            })
          }
        } else {
          console.error('No http client found to send keepalive action. You must use ofetch as init param.')
        }
      },
      cancelDeletion() {
        if (this.httpLib) {
          return this.httpLib(`${this.directoryUrl}/api/users/${this.user.id}`, {
            method: 'PATCH',
            body: { plannedDeletion: null }
          }).then(() => {
            this.readCookie()
          })
        } else {
          console.error('No http client found to cancel deletion. You must use ofetch as init param.')
        }
      },
      error(params) {
        console.error('Error', params.statusCode, params.message)
        window.location.href = `${this.env.publicUrl}/error?statusCode=${params.statusCode}&message=${encodeURIComponent(params.message)}`
      },
      fetchActiveAccountDetails(forceRefresh = false) {
        if (!this.activeAccount) {
          return
        }
        if (
          !forceRefresh &&
          this.activeAccountDetails &&
          this.activeAccountDetails.type === this.activeAccount.type &&
          this.activeAccountDetails.id === this.activeAccount.id
        ) {
          return
        }
        if (this.httpLib) {
          return this.httpLib(`${this.directoryUrl}/api/${this.activeAccount.type}s/${this.activeAccount.id}`).then(res => {
            const data = { ...res, type: this.activeAccount.type }
            this.activeAccountDetails = data
            return data
          })
        }
        console.error('No http client found to fetch active account details. You must use ofetch as init param.')
      },
      init(params) {
        if (!params.cookies) {
          throw new Error('You must init the store with a "cookies" wrapper with simple get and set methods like js-cookie, cookie-universal-nuxt or other')
        }
        if (!params.httpLib) {
          throw new Error('You must init the store with ofetch')
        }
        this.cookies = params.cookies
        delete params.cookies
        this.httpLib = params.httpLib
        delete params.httpLib
        if (params.baseUrl) {
          throw new Error('baseUrl param is deprecated, replaced with directoryUrl')
        }
        if (params.cookieDomain) {
          throw new Error('cookieDomain param is deprecated, replaced with directoryUrl')
        }
        if (params.sessionDomain) {
          throw new Error('sessionDomain param is deprecated, replaced with directoryUrl')
        }
        if (!params.directoryUrl && params.directoryUrl !== '') {
          throw new Error('directoryUrl param is required')
        }
        params.directoryUrl = params.directoryUrl.endsWith('/') ? params.directoryUrl.slice(0, -1) : params.directoryUrl
        this.setAny({ ...params })
        this.readCookie()
      },
      keepalive() {
        if (!this.user) {
          return
        }
        if (this.httpLib) {
          return this.httpLib(`${this.directoryUrl}/api/auth/keepalive`, {
            method: 'POST'
          }).then(res => {
            this.readCookie()
            return res
          })
        }
        console.error('No http client found to send keepalive action. You must use ofetch as init param.')
      },
      login(redirect) {
        goTo(this.loginUrl(redirect))
      },
      logout(redirect) {
        if (!this.httpLib) {
          console.error('No http client found to send logout action. You must use ofetch as init param.')
          return
        }
        // prevents breaking change when the logout action is called with a click event as parameter
        if (typeof redirect === 'object') {
          redirect = null
        }
        return this.httpLib(`${this.directoryUrl}/api/auth`, {
          method: 'DELETE'
        }).then(() => {
          // sometimes server side cookie deletion is not applied immediately in browser local js context
          // so we do it here to
          this.cookies.set(`${this.cookieName}`, '', this.cookieOpts)
          this.cookies.set(`${this.cookieName}_org`, '', this.cookieOpts)
          this.cookies.set(`${this.cookieName}_dep`, '', this.cookieOpts)

          this.user = null
          if (redirect && redirect !== false) {
            return goTo(redirect)
          } else if (this.logoutRedirectUrl) {
            return goTo(this.logoutRedirectUrl)
          } else if (this.reloadAfterLogout && typeof window !== 'undefined') {
            window.location.reload()
          }
        })
      },
      loop(cookies) {
        if (!this.cookies && !cookies) {
          throw new Error('You must init the store vith a "cookies" wrapper with simple get and set methods like js-cookie, cookie-universal-nuxt or other')
        }
        if (!this.httpLib) {
          throw new Error('You must init the store with ofetch')
        }

        this.cookies = this.cookies || cookies
        setTimeout(() => {
          // always start by a keepalive to fetch latest session info on page load
          this.keepalive()

          setInterval(() => {
            // read the cookie regularily in case it was updated by another page
            this.readCookie()

            // also check if the token is getting a little bit old, and renew it
            if (this.user?.exp) {
              const timestamp = Date.now() / 1000
              const tooOld = timestamp > (this.user.iat + ((this.user.exp - this.user.iat) / 3))
              if (tooOld) {
                this.keepalive()
              }
            }
          }, this.interval)

          // a "stupid" keepalive loop that spams the server with keepalive requests, avoid it
          if (this.autoKeepalive) {
            console.warn('autokeepalive option is not recommended, it creates unnecessary http traffic')
            this.keepalive()
            setInterval(() => this.keepalive(), this.autoKeepalive)
          }
        }, 0)
      },
      readCookie() {
        let cookie = this.cookies.get(this.cookieName, { fromRes: true })
        if (cookie === undefined) {
          cookie = this.cookies.get(this.cookieName)
        }
        if (cookie) {
          const user = jwtDecodeAlive(cookie)
          if (user) {
            let organizationId = this.cookies.get(`${this.cookieName}_org`, { fromRes: true })
            if (organizationId === undefined) organizationId = this.cookies.get(`${this.cookieName}_org`)
            let departmentId = this.cookies.get(`${this.cookieName}_dep`, { fromRes: true })
            if (departmentId === undefined) departmentId = this.cookies.get(`${this.cookieName}_dep`)
            if (organizationId) {
              user.organization = (user.organizations || []).find(o => o.id === organizationId)
              if (departmentId) {
                user.organization = (user.organizations || []).find(o => o.id === organizationId && o.department === departmentId)
              }

              // consumerFlag is used by applications to decide if they should ask confirmation to the user
              // of the right quotas or other organization related context to apply
              // it is 'user' if id_token_org is an empty string or is equal to 'user'
              // it is null if id_token_org is absent or if it does not match an organization of the current user
              // it is the id of the orga in id_token_org
              if (user.organization) {
                user.consumerFlag = user.organization.id
              } else if (organizationId.toLowerCase() === 'user') {
                user.consumerFlag = 'user'
              }
            } else {
              user.organization = null
            }
          }
          this.updateUser(user)
        } else {
          this.user = null
        }
        if (this.activeAccountDetails && (
          !this.activeAccount ||
          this.activeAccount.type !== this.activeAccountDetails.type ||
          this.activeAccount.id !== this.activeAccountDetails.id
        )) {
          this.activeAccountDetails = null
        }
        this.initialized = true
      },
      setAdminMode(params) {
        let adminMode, redirect, extraParams
        if (typeof params === 'boolean') {
          adminMode = params
        } else {
          adminMode = params.value
          redirect = params.redirect
          extraParams = params.extraParams
        }
        if (adminMode) {
          let url = this.loginUrl(redirect, true, extraParams)
          if (this.user) url += `&email=${encodeURIComponent(this.user.email)}`
          goTo(url + '&adminMode=true')
        } else {
          if (!this.httpLib) {
            console.error('No http client found to send logout action. You must use ofetch as init param.')
            return
          }
          this.httpLib(`${this.directoryUrl}/api/auth/adminmode`, {
            method: 'DELETE'
          }).then(() => {
            this.readCookie()
            goTo(redirect || this.logoutRedirectUrl || '/')
          })
        }
        this.user.adminMode = adminMode
      },
      setAny(params) {
        // Replace undefined with null to prevent breaking reactivity
        Object.keys(params).forEach(k => {
          if (params[k] === undefined) params[k] = null
        })
        Object.assign(this, params)
      },
      setDarkMode(value) {
        const maxAge = 60 * 60 * 24 * 100 // 100 days
        this.cookies.set('theme_dark', '' + value, { expires: maxAge, path: '/' })
        this.vuetify.theme.global.name = value ? 'dark' : 'light'
      },
      switchOrganization(organizationId) {
        if (organizationId) {
          const [org, dep] = organizationId.split(':')
          this.cookies.set(`${this.cookieName}_org`, org, this.cookieOpts)
          this.cookies.set(`${this.cookieName}_dep`, dep || '', this.cookieOpts)
        } else {
          this.cookies.set(`${this.cookieName}_org`, '', this.cookieOpts)
          this.cookies.set(`${this.cookieName}_dep`, '', this.cookieOpts)
        }
        if (this.reloadAfterSwitchOrganization && typeof window !== 'undefined') window.location.reload()
        else this.readCookie({ fromRes: true })
      },
      updateUser(user) {
        if (user && this.user && this.user.id === user.id) {
          Object.assign(this.user, user)
          if (this.user.ipa && !user.ipa) delete this.user.ipa
          if (this.user.pd && !user.pd) delete this.user.pd
        } else {
          this.user = user
        }
      },
      ...overrideConfig.actions
    }
  })

  return storeDefinition
}
