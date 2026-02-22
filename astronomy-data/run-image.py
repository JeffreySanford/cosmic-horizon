# placeholder CASA script used by the legacy worker or the astro service.
# the FastAPI microservice now contains the primary pipeline logic, so this
# script is optional and may be removed in the future once the service is
# self-sufficient.

# this script assumes the input dataset is mounted at /data/sample.ms and
# writes output to /data/out.fits.  In a real implementation it would call
# tclean or other CASA tasks.

print('Running dummy CASA imaging script...')

# create an empty FITS file as a placeholder
from astropy.io import fits
import numpy as np

hdu = fits.PrimaryHDU(np.zeros((100, 100)))
hdu.writeto('/data/out.fits', overwrite=True)

print('Dummy FITS file created at /data/out.fits')
