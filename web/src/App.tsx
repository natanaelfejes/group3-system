import { useEffect, useState } from 'react'
import { clearUser, loadUser, login, saveUser, type Role, type User } from './auth.ts'
import { Layout } from './components/Layout.tsx'
import { pagesFor } from './navigation.ts'
import { LoginPage } from './pages/LoginPage.tsx'
import {Route, Routes} from "react-router";

function App() {
  const [user, setUser] = useState<User | null>(loadUser)
  const [path, setPath] = useState(window.location.pathname)

  // Makes the browser's back and forward buttons work
  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const pages = user ? pagesFor(user.role) : []
  // If the URL doesn't exist, or this role isn't allowed on that page, we just show the dashboard instead
  const page = pages.find((p) => p.path === path) ?? pages[0]
  //const page = pages.find((p) => matchRoute(p.path, path)) ?? pages[0]
  const shownPath = page ? page.path : '/login'

  // Fixes the URL in the address bar so it matches the page we're actually showing
  useEffect(() => {
    if (window.location.pathname !== shownPath) window.history.replaceState(null, '', shownPath)
  }, [shownPath])

  function navigate(to: string) {
    window.history.pushState(null, '', to)
    setPath(to)
  }

  async function handleLogin(role: Role) {
    const loggedIn = await login(role)
    saveUser(loggedIn)
    setUser(loggedIn)
    navigate('/dashboard')
  }

  function handleLogout() {
    clearUser()
    setUser(null)
    navigate('/login')
  }

  if (!user || !page) return <LoginPage onLogin={handleLogin} />

  return (
      <>

    <Layout user={user} pages={pages} currentPath={page.path} onNavigate={navigate} onLogout={handleLogout}>
      <Routes>
        {pages.length != 0 ? pages.map((page) => {
          if(page.isIndex) {
            return (<Route index path={page.path} Component={page.Component}/>);
          }

          return (<Route path={page.path} Component={page.Component}/>)
        }) : <></>
        }
      </Routes>
    </Layout>
      </>
  )
}

export default App
