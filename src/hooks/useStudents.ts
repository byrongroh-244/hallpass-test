import { useEffect, useState } from 'react'
import { ref, onValue } from 'firebase/database'
import { db } from '../firebase/config'
import type { StudentRecord } from '../types'

export function useStudents(teacherId: string): Record<string, StudentRecord> {
  const [students, setStudents] = useState<Record<string, StudentRecord>>({})
  useEffect(() => {
    setStudents({})
    const unsubscribe = onValue(ref(db, `teachers/${teacherId}/students`), snap => {
      setStudents((snap.val() as Record<string, StudentRecord>) ?? {})
    })
    return () => unsubscribe()
  }, [teacherId])
  return students
}
