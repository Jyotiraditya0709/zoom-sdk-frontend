import { useLocation } from 'react-router-dom';
import { useMeeting } from '../contexts/MeetingContext';

export const useOrgId = () => {
  const location = useLocation();
  
  // First try to get orgId from URL parameters
  const params = new URLSearchParams(location.search);
  const urlOrgId = params.get('orgId');
  
  // If not in URL, try to get from meeting context
  let meetingOrgId = null;
  try {
    const { orgId } = useMeeting();
    meetingOrgId = orgId;
  } catch (error) {
    // Meeting context not available, continue with URL orgId
  }
  
  // Return URL orgId if available, otherwise meeting orgId, otherwise null
  return urlOrgId || meetingOrgId;
};
