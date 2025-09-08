import React from 'react';

const DynamicLogo = ({ orgId, className = "", alt = "Logo", ...props }) => {
  // Define the logo mapping based on organization ID
  const getLogoSrc = (orgId) => {
    switch (orgId) {
      case '00324e7c-0a3e-40d6-a583-ae54105c6311':
        return '/assest/svg/mu-logo-new.svg';
      case '00324e7c-0a3e-40d6-a583-ae54105c6322':
        return '/assest/svg/tetrLogo.svg';
      default:
        // Default logo (current getPrepped.svg)
        return '/assest/svg/getPrepped.svg';
    }
  };

  const logoSrc = getLogoSrc(orgId);

  return (
    <img 
      src={logoSrc} 
      alt={alt} 
      className={className}
      {...props}
    />
  );
};

export default DynamicLogo;
