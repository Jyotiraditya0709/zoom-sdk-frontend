import { useLocation } from 'react-router-dom';
import { useMeeting } from '../contexts/MeetingContext';

export const useOrgId = () => {
  const location = useLocation();
  
  // First try to get orgId from URL parameters
  const params = new URLSearchParams(location.search);
  const urlOrgId = params.get('orgId');
  
  // If not in URL, try to get from meeting context
  let meetingOrgId = null;
  let isLoading = false;
  try {
    const { orgId, loading } = useMeeting();
    meetingOrgId = orgId;
    isLoading = loading;
  } catch (error) {
    // Meeting context not available, continue with URL orgId
  }
  
  // Return URL orgId if available, otherwise meeting orgId, otherwise null
  return {
    orgId: urlOrgId || meetingOrgId,
    isLoading: isLoading && !urlOrgId // Only show loading if we're waiting for meeting data and no URL orgId
  };
};
