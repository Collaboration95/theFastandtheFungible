import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mkdirSync } from 'node:fs'
const sections=['Models','Network','Budget and limits','Payments','Wallets','Writers','Connect an agent','Data','About']
test('owner settings sections and onboarding at 1280x800', async ({page})=>{
  await page.setViewportSize({width:1280,height:800})
  await page.emulateMedia({reducedMotion:'reduce'})
  mkdirSync('docs/evidence/settings',{recursive:true})
  await page.goto('/?settings=1')
  await expect(page.getByRole('heading',{name:'Settings',exact:true})).toBeVisible()
  await expect(page.getByRole('status').filter({hasText:'Only you'})).toBeVisible()
  for (const section of sections) {
    await page.getByRole('navigation',{name:'Settings sections'}).getByRole('button',{name:section,exact:true}).click()
    await expect(page.locator('#owner-heading')).toHaveText(section)
    await page.screenshot({path:`docs/evidence/settings/${section.toLowerCase().replaceAll(' ','-')}.png`})
    const violations=(await new AxeBuilder({page}).include('.ra-settings').analyze()).violations.filter(v=>['serious','critical'].includes(v.impact || ''))
    expect(violations).toEqual([])
  }
  await page.goto('/?settings=1&onboarding=1')
  await expect(page.getByRole('heading',{name:'Make this workspace yours'})).toBeVisible()
  await page.screenshot({path:'docs/evidence/settings/onboarding.png'})
})
