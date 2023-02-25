import React, { useState, useRef, useEffect } from 'react'

export default function MovableCom() {
  const [currentRight, setCurrentRight] = useState(0)
  const [currentTop, setCurrentTop] = useState(0)
  let right = 0
  let top = 0
  let innerRight = 0
  let innerTop = 0
  useEffect(() => {
    const bodyDom = document.body
    const drawerDom: HTMLDivElement = document.querySelector(
      '.drawer-wrapper-lwf'
    ) as HTMLDivElement
    bodyDom.ondragover = (e) => {
      e.preventDefault()
    }
    drawerDom!.draggable = true
    drawerDom!.ondragstart = (e) => {
      innerRight = bodyDom.clientWidth - e.clientX - right
      innerTop = e.clientY - top
    }
    drawerDom!.ondragend = (e) => {
      console.log(e)
      right = bodyDom.clientWidth - e.clientX - innerRight
      top = e.clientY - innerTop
      setCurrentRight(right)
      setCurrentTop(top)
    }
    return () => {
      bodyDom.ondragover = null
    }
  }, [])

  return (
    <div
      id="Stats-output"
      className="drawer-wrapper-lwf"
      style={{
        position: 'absolute',
        right: currentRight,
        top: currentTop,
        zIndex: 9999,
      }}></div>
  )
}
