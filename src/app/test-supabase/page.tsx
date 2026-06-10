import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export default async function Page() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // Note: This will fail if the 'todos' table doesn't exist, 
  // but it verifies the client initialization.
  const { data: todos, error } = await supabase.from('todos').select()

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Supabase Connection Test</h1>
      {error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p>Error connecting to Supabase: {error.message}</p>
          <p className="text-sm mt-2">Note: This is expected if the 'todos' table hasn't been created yet.</p>
        </div>
      ) : (
        <ul className="list-disc pl-5">
          {todos?.map((todo: any) => (
            <li key={todo.id}>{todo.name}</li>
          ))}
          {todos?.length === 0 && <li>No todos found.</li>}
        </ul>
      )}
    </div>
  )
}
