import { useEffect } from 'react';
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import Workspace from './components/Workspace'

const App = () => {
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // If you always want to warn when leaving:
      event.preventDefault();
      return "Are you sure you want to leave the page? Information will be lost.";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

return (
    <div className='flex flex-col w-screen h-screen'>
      <Header />
      <div className='flex flex-1'>
          <Sidebar/>
          <main className='flex-1 p-9 bg-background'>
            <Workspace/>
          </main>
      </div>
    </div>
  )
}
export default App
