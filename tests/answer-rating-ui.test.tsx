// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import AnswerRating from '../src/components/AnswerRating'
import { getAnswerRating, rateAnswer } from '../src/api'
vi.mock('../src/api',()=>({getAnswerRating:vi.fn(),rateAnswer:vi.fn()}))
afterEach(()=>{cleanup();vi.resetAllMocks()})
it('asks quietly after loading, saves one Yes vote, and restores the saved result',async()=>{
 vi.mocked(getAnswerRating).mockResolvedValue({yes:null});vi.mocked(rateAnswer).mockResolvedValue({yes:true})
 render(<AnswerRating runId="run" amountMinor={40}/>);expect(await screen.findByText('Worth S$0.40?')).toBeTruthy()
 fireEvent.click(screen.getByRole('button',{name:'Yes'}));expect(await screen.findByText('Thanks for your feedback.')).toBeTruthy();expect(rateAnswer).toHaveBeenCalledWith('run',true);expect(screen.queryByRole('button',{name:'No'})).toBeNull()
})
it('leaves answers usable when saving fails and hides the prompt when the feature is disabled',async()=>{
 vi.mocked(getAnswerRating).mockResolvedValue({yes:null});vi.mocked(rateAnswer).mockRejectedValue(new Error('offline'))
 render(<AnswerRating runId="run" amountMinor={40}/>);fireEvent.click(await screen.findByRole('button',{name:'No'}));expect(await screen.findByRole('status')).toBeTruthy();expect(screen.getByRole('button',{name:'Yes'}).hasAttribute('disabled')).toBe(false)
 cleanup();vi.mocked(getAnswerRating).mockRejectedValue(new Error('disabled'));const {container}=render(<AnswerRating runId="other" amountMinor={40}/>);await Promise.resolve();expect(container.textContent).toBe('')
})
